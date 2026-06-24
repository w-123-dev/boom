const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');
const db = require('./db');
const { verifyToken } = require('./utils/jwt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.get('/api/rooms', function(req, res) {
  var list = [];
  rooms.forEach(function(r) { list.push({ code: r.code, players: r.players.length, status: r.status }); });
  res.json(list);
});

const onlineUsers = new Map();
const rooms = new Map();

function generateRoomCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code;
  do {
    code = '';
    for (var i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

io.use(function(socket, next) {
  var token = socket.handshake.auth.token;
  if (!token) return next(new Error('Not logged in'));
  var payload = verifyToken(token);
  if (!payload) return next(new Error('Token expired'));
  socket.userId = payload.userId;
  next();
});

io.on('connection', function(socket) {
  var user = db.prepare('SELECT id, username, nickname, rating FROM users WHERE id = ?').get(socket.userId);
  if (!user) return socket.disconnect();

  onlineUsers.set(socket.id, { id: user.id, username: user.username, nickname: user.nickname });
  socket.join('lobby');
  io.to('lobby').emit('online_users', Array.from(onlineUsers.values()));

  socket.on('lobby_chat', function(msg) {
    if (typeof msg !== 'string' || msg.length > 100) return;
    io.to('lobby').emit('lobby_chat', { user: user.nickname, msg: msg });
  });

  socket.on('request_room_list', function() {
    var list = [];
    rooms.forEach(function(r) {
      list.push({
        code: r.code, hostId: r.hostId, playerCount: r.players.length,
        maxPlayers: r.maxPlayers, gameType: r.gameType,
        hasPassword: !!r.password, status: r.status
      });
    });
    socket.emit('room_list', list);
  });

  socket.on('create_room', function(data) {
    if (rooms.size >= 50) return socket.emit('join_result', { success: false, error: 'Room full' });
    var code = generateRoomCode();
    var room = {
      code: code, hostId: user.id,
      gameType: data.gameType || 'bomberman',
      maxPlayers: Math.min(data.maxPlayers || 4, 4),
      hasPassword: !!data.password, password: data.password || null,
      players: [{ userId: user.id, nickname: user.nickname, socketId: socket.id, ready: false }],
      status: 'waiting', game: null
    };
    rooms.set(code, room);
    socket.join('g_' + code);
    socket.emit('join_result', { success: true, code: code });
    io.to('lobby').emit('room_created', {
      code: code, hostId: room.hostId, playerCount: 1,
      maxPlayers: room.maxPlayers, gameType: room.gameType,
      hasPassword: room.hasPassword, status: room.status
    });
  });

  socket.on('join_room', function(data) {
    var room = rooms.get(data.code);
    if (!room) return socket.emit('join_result', { success: false, error: 'Room not found' });
    if (room.status === 'playing') return socket.emit('join_result', { success: false, error: 'Game in progress' });
    if (room.players.length >= room.maxPlayers) {
      return socket.emit('join_result', { success: false, error: 'Room full' });
    }
    if (room.password && data.password !== room.password) {
      return socket.emit('join_result', { success: false, error: 'Wrong password' });
    }
    var found = false;
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i].userId === user.id) {
        room.players[i].socketId = socket.id;
        found = true;
        break;
      }
    }
    if (!found) {
      room.players.push({ userId: user.id, nickname: user.nickname, socketId: socket.id, ready: false });
    }
    socket.join('g_' + room.code);
    broadcastRoomUpdate(room);
    socket.emit('join_result', { success: true, code: room.code });
  });

  socket.on('refresh_room', function(data) {
    var room = rooms.get(data.code);
    if (!room) return socket.emit('error_msg', 'Room not found');
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i].userId === user.id) {
        room.players[i].socketId = socket.id;
        break;
      }
    }
    socket.join('g_' + room.code);
    socket.emit('room_update', formatRoomData(room));
    // If room has finished game results, send them
    if (room.lastResults) {
      socket.emit('game_results', room.lastResults);
    }
  });

  socket.on('room_ready', function() {
    var room = findRoomBySocket(socket.id);
    if (!room) return;
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i].socketId === socket.id) {
        room.players[i].ready = !room.players[i].ready;
        break;
      }
    }
    broadcastRoomUpdate(room);
  });

  socket.on('start_game', function() {
    var room = findRoomBySocket(socket.id);
    if (!room) return socket.emit('error_msg', 'Not in a room');
    if (room.hostId !== user.id) return socket.emit('error_msg', 'Only host can start');
    if (room.players.length < 2) return socket.emit('error_msg', 'Need at least 2 players');
    // Check ready: if this is a new game (after a previous game finished), skip ready check
    if (room.status !== 'waiting') return socket.emit('error_msg', 'Game already in progress');
    startGame(room);
  });

  socket.on('leave_room', function() {
    leaveRoom(socket, user);
    socket.leave('lobby');
  });

  socket.on('game_input', function(data) {
    var room = findRoomBySocket(socket.id);
    if (!room || !room.game || room.game.state !== 'playing') return;
    room.game.handleInput(user.id, data);
  });

  socket.on('plant_bomb', function() {
    var room = findRoomBySocket(socket.id);
    if (!room || !room.game || room.game.state !== 'playing') return;
    room.game.plantBomb(user.id);
  });

  socket.on('join_game', function(data) {
    var room = rooms.get(data.code);
    if (!room) return;
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i].userId === user.id) {
        room.players[i].socketId = socket.id;
        break;
      }
    }
    socket.join('g_' + room.code);
    if (room.game) {
      socket.emit('game_state', room.game.getState());
    }
  });

  socket.on('request_results', function(data) {
    var room = rooms.get(data.code);
    if (room && room.lastResults) {
      socket.emit('game_over', room.lastResults);
    }
  });

  socket.on('disconnect', function() {
    onlineUsers.delete(socket.id);
    io.to('lobby').emit('online_users', Array.from(onlineUsers.values()));
  });
});

function findRoomBySocket(socketId) {
  var result = null;
  rooms.forEach(function(room) {
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i].socketId === socketId) {
        result = room; return;
      }
    }
  });
  return result;
}

function formatRoomData(room) {
  var players = [];
  for (var i = 0; i < room.players.length; i++) {
    players.push({ userId: room.players[i].userId, nickname: room.players[i].nickname, ready: room.players[i].ready });
  }
  return {
    code: room.code, hostId: room.hostId, gameType: room.gameType,
    maxPlayers: room.maxPlayers, hasPassword: !!room.password,
    players: players, status: room.status
  };
}

function broadcastRoomUpdate(room) {
  var data = formatRoomData(room);
  io.to('g_' + room.code).emit('room_update', data);
  io.to('lobby').emit('room_updated', {
    code: room.code, playerCount: room.players.length,
    maxPlayers: room.maxPlayers, status: room.status
  });
}

function leaveRoom(socket, user) {
  var room = findRoomBySocket(socket.id);
  if (!room) return;
  socket.leave('g_' + room.code);
  var newPlayers = [];
  for (var i = 0; i < room.players.length; i++) {
    if (room.players[i].socketId !== socket.id) {
      newPlayers.push(room.players[i]);
    }
  }
  room.players = newPlayers;
  if (room.players.length === 0) {
    rooms.delete(room.code);
    io.to('lobby').emit('room_removed', room.code);
    return;
  }
  if (room.hostId === user.id) {
    room.hostId = room.players[0].userId;
  }
  broadcastRoomUpdate(room);
}

var SCORE_TABLE = [0, 20, 10, -5, -10];

function startGame(room) {
  room.status = 'playing';
  room.lastResults = null;
  for (var i = 0; i < room.players.length; i++) {
    room.players[i].ready = false;
  }

  var BombermanGame = require('./game-engine/bomberman/game');
  var game = new BombermanGame(room.players, config);
  room.game = game;

  var playerData = [];
  for (var j = 0; j < game.players.length; j++) {
    var p = game.players[j];
    playerData.push({ id: p.id, nickname: p.nickname, x: p.x, y: p.y, color: p.color, direction: p.direction, alive: true, shielded: false });
  }

  io.to('g_' + room.code).emit('game_start', {
    map: game.map, players: playerData, gridSize: game.gridSize
  });

  var tickInterval = setInterval(function() {
    try {
      if (!room.game || room.game.state === 'finished') { console.log('TICK: game finished, clearing');
        clearInterval(tickInterval); return;
      }
      var state = room.game.tick();
      if (state.tick % 20 === 0) {
        var aliveStr = '';
        for (var li = 0; li < state.players.length; li++) { aliveStr += state.players[li].nickname + '=' + (state.players[li].alive?'A':'D') + ' '; }
        console.log('TICK ' + state.tick + ': ' + aliveStr + 'bombs=' + (state.bombs||[]).length);
      }
      io.to('g_' + room.code).emit('game_state', state);

      if (state.state === 'finished') { console.log('TICK: GAME OVER');
        clearInterval(tickInterval);
        var rankings = room.game.getRankings(); console.log('Rankings:', JSON.stringify(rankings));
        var winner = room.game.winner; console.log('Winner:', winner);
        var matchId = saveMatch(room, winner, rankings); console.log('Match saved:', matchId);
        room.lastResults = { rankings: rankings, matchId: matchId };
        io.to('g_' + room.code).emit('game_over', {
          winner: winner, matchId: matchId, rankings: rankings
        });
        // Reset room for next game
        room.status = 'waiting';
        for (var ri = 0; ri < room.players.length; ri++) { room.players[ri].ready = false; }
      }
    } catch(e) {
      console.log('GAME LOOP ERROR:', e.message);
      console.log(e.stack);
      clearInterval(tickInterval);
    }
  }, config.GAME_TICK_MS || 50);
  

  // Force end after 5 minutes as fallback
  setTimeout(function() {
    if (room.game && room.game.state === 'playing') {
      console.log('FORCE END: Game timed out');
      room.game.state = 'finished';
      room.game.checkWinCondition();
      var rankings = room.game.getRankings();
      var winner = room.game.winner;
      var matchId = saveMatch(room, winner, rankings);
      room.lastResults = { rankings: rankings, matchId: matchId };
      io.to('g_' + room.code).emit('game_over', {
        winner: winner, matchId: matchId, rankings: rankings
      });
    }
  }, 300000);
}

function saveMatch(room, winnerId, rankings) {
  if (!rankings) rankings = [];
  var match = db.prepare(
    "INSERT INTO matches (room_id, game_type, max_players, started_at, ended_at, duration_secs, status) VALUES (?, ?, ?, datetime('now'), datetime('now'), 0, 'finished')"
  ).run(room.code, 'bomberman', room.maxPlayers);
  var matchId = match.lastInsertRowid;

  for (var i = 0; i < room.players.length; i++) {
    var p = room.players[i];
    var rank = 4;
    for (var j = 0; j < rankings.length; j++) {
      if (rankings[j].id === p.userId) {
        rank = rankings[j].rank;
        break;
      }
    }
    var scoreChange = SCORE_TABLE[rank] || -10;
    db.prepare('INSERT INTO match_players (match_id, user_id, player_index, is_winner, kills) VALUES (?, ?, ?, ?, ?)')
      .run(matchId, p.userId, i, p.userId === winnerId ? 1 : 0, 0);
    var sql = 'UPDATE users SET total_games = total_games + 1';
    if (p.userId === winnerId) { sql += ', wins = wins + 1'; }
    sql += ', rating = MAX(100, rating + ' + scoreChange + ')';
    sql += ' WHERE id = ?';
    db.prepare(sql).run(p.userId);
  }
  return matchId;
}

process.on('uncaughtException', function(err) {
  console.log('CRASH:', err.message);
  console.log(err.stack);
});

server.listen(config.PORT, function() {
  console.log('BoomArena running at http://localhost:' + config.PORT);
});
