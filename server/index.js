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
app.use('/api/friends', require('./routes/friends'));
app.use('/api/admin', require('./routes/admin'));
app.get('/api/rooms', function(req, res) {
  var list = [];
  rooms.forEach(function(r) { list.push({ code: r.code, players: r.players.length, status: r.status }); });
  res.json(list);
});

const onlineUsers = new Map();
const rooms = new Map();
const disconnectTimers = new Map(); // userId -> setTimeout id

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

  // Remove stale entries for this user (from previous page navigations)
  var staleSockets = [];
  onlineUsers.forEach(function(val, key) {
    if (val.id === user.id) staleSockets.push(key);
  });
  for (var si = 0; si < staleSockets.length; si++) { onlineUsers.delete(staleSockets[si]); }
  onlineUsers.set(socket.id, { id: user.id, username: user.username, nickname: user.nickname });
  socket.join('lobby');
  io.to('lobby').emit('online_users', Array.from(onlineUsers.values()));

  var lastChatTime = 0;

  socket.on('lobby_chat', function(msg) {
    if (typeof msg !== 'string' || msg.length > 100) return;
    var now = Date.now();
    if (now - lastChatTime < 1000) return;
    lastChatTime = now;
    io.to('lobby').emit('lobby_chat', { user: user.nickname, msg: msg });
    db.prepare('INSERT INTO chat_messages (room, user_id, user_name, message) VALUES (?, ?, ?, ?)').run('lobby', user.id, user.nickname, msg);
    db.prepare('DELETE FROM chat_messages WHERE room = ? AND id NOT IN (SELECT id FROM chat_messages WHERE room = ? ORDER BY id DESC LIMIT 200)').run('lobby', 'lobby');
  });

  socket.on('request_room_list', function() {
    var list = [];
    rooms.forEach(function(r) {
      list.push({
      code: r.code, hostId: r.hostId, playerCount: r.players.length,
      maxPlayers: r.maxPlayers, gameType: r.gameType,
      hasPassword: !!r.password, status: r.status,
      mapSize: r.mapSize,
      theme: r.theme || 'default'
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
      status: 'waiting', game: null,
      mapSize: Math.min(Math.max(data.mapSize || 17, 13), 21),
      theme: data.theme || 'default'
    };
    rooms.set(code, room);
    socket.join('g_' + code);
    socket.emit('join_result', { success: true, code: code });
    io.to('lobby').emit('room_created', {
      code: code, hostId: room.hostId, playerCount: 1,
      maxPlayers: room.maxPlayers, gameType: room.gameType,
      hasPassword: room.hasPassword, status: room.status,
      mapSize: room.mapSize,
      theme: room.theme || 'default'
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
        room.players[i].disconnected = false;
        if (disconnectTimers.has(user.id)) { clearTimeout(disconnectTimers.get(user.id)); disconnectTimers.delete(user.id); }
        // Also clear game engine disconnected flag
        if (room.game) {
          for (var jgi = 0; jgi < room.game.players.length; jgi++) {
            if (room.game.players[jgi].id === user.id) { room.game.players[jgi].disconnected = false; break; }
          }
        }
        break;
      }
    }
    socket.join('g_' + room.code);
    socket.emit('room_update', formatRoomData(room));
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
    if (room.status !== 'waiting') return socket.emit('error_msg', 'Game already in progress');
    var allReady = true;
    for (var ri = 0; ri < room.players.length; ri++) {
      if (!room.players[ri].ready && room.players[ri].userId !== room.hostId) {
        allReady = false; break;
      }
    }
    if (!allReady) return socket.emit('error_msg', 'Wait for all players to ready');
    startGame(room);
  });

  socket.on('leave_room', function() {
    leaveRoom(socket, user);
    socket.leave('lobby');
  });

  socket.on('update_room_settings', function(data) {
    var room = findRoomBySocket(socket.id);
    if (!room) return;
    if (room.hostId !== user.id) return;
    if (room.status !== 'waiting') return;
    if (data.mapSize) {
      room.mapSize = Math.min(Math.max(data.mapSize, 13), 21);
    }
    if (data.theme) {
      var validThemes = ['default', 'ice', 'volcano'];
      if (validThemes.indexOf(data.theme) >= 0) room.theme = data.theme;
    }
    broadcastRoomUpdate(room);
  });

  socket.on('game_input', function(data) {
    var room = findRoomBySocket(socket.id);
    if (!room || !room.game || room.game.state !== 'playing') return;
    room.game.handleInput(user.id, data);
  });

  socket.on('plant_bomb', function() {
    try {
      var room = findRoomBySocket(socket.id);
      if (!room || !room.game || room.game.state !== 'playing') return;
      room.game.plantBomb(user.id);
    } catch(e) {
      console.log('PLANT BOMB ERROR:', e.message);
      console.log(e.stack);
    }
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
      var initState = room.game.getState();
      initState.theme = room.theme || 'default';
      socket.emit('game_state', initState);
    }
  });

  socket.on('request_results', function(data) {
    var room = rooms.get(data.code);
    if (room && room.lastResults) {
      socket.emit('game_over', room.lastResults);
    }
  });

  socket.on('private_msg', function(data) {
    if (typeof data.msg !== 'string' || data.msg.length > 200) return;
    var now2 = Date.now();
    if (now2 - lastChatTime < 1000) return;
    lastChatTime = now2;
    var targetSid = null;
    onlineUsers.forEach(function(v, k) { if (v.id === data.targetId) targetSid = k; });
    var cid = user.id < data.targetId ? user.id + '_' + data.targetId : data.targetId + '_' + user.id;
    db.prepare('INSERT INTO chat_messages (room, user_id, user_name, message) VALUES (?, ?, ?, ?)').run('pm_' + cid, user.id, user.nickname, data.msg);
    db.prepare('DELETE FROM chat_messages WHERE room = ? AND id NOT IN (SELECT id FROM chat_messages WHERE room = ? ORDER BY id DESC LIMIT 100)').run('pm_' + cid, 'pm_' + cid);
    if (targetSid) {
      io.to(targetSid).emit('private_msg', { from: user.id, fromName: user.nickname, msg: data.msg });
      socket.emit('private_msg', { from: user.id, fromName: user.nickname, msg: data.msg, sent: true });
    } else {
      socket.emit('private_msg_error', 'User is offline');
    }
  });

  socket.on('request_chat_history', function(data) {
    var rm = data.room || 'lobby';
    var msgs = db.prepare('SELECT user_name, message FROM chat_messages WHERE room = ? ORDER BY id DESC LIMIT 20').all(rm);
    msgs.reverse();
    socket.emit('chat_history', { room: rm, messages: msgs });
  });

  socket.on('disconnect', function() {
    onlineUsers.delete(socket.id);
    io.to('lobby').emit('online_users', Array.from(onlineUsers.values()));
    var room = findRoomBySocket(socket.id);
    if (room && room.game && room.game.state === 'playing') {
      // Skip if this socket is no longer the player's current socket
      var stillCurrent = false;
      for (var sc = 0; sc < room.players.length; sc++) {
        if (room.players[sc].userId === user.id) {
          if (room.players[sc].socketId === socket.id) { stillCurrent = true; }
          break;
        }
      }
      if (!stillCurrent) return;
      for (var di = 0; di < room.players.length; di++) {
        if (room.players[di].userId === user.id) { room.players[di].disconnected = true; break; }
      }
      // Also mark game engine player
      if (room.game) {
        for (var gdi = 0; gdi < room.game.players.length; gdi++) {
          if (room.game.players[gdi].id === user.id) { room.game.players[gdi].disconnected = true; break; }
        }
      }
      // Timeout disabled - player stays alive and can rejoin via join_game
    }
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
    players: players, status: room.status,
    mapSize: room.mapSize,
    theme: room.theme || 'default'
  };
}

function broadcastRoomUpdate(room) {
  var data = formatRoomData(room);
  io.to('g_' + room.code).emit('room_update', data);
  io.to('lobby').emit('room_updated', {
    code: room.code, playerCount: room.players.length,
    maxPlayers: room.maxPlayers, status: room.status,
    mapSize: room.mapSize,
    theme: room.theme || 'default'
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
  // Fetch avatar and game_character from DB before creating game
  for (var pi = 0; pi < room.players.length; pi++) {
    var ua = db.prepare('SELECT avatar, game_character FROM users WHERE id = ?').get(room.players[pi].userId);
    room.players[pi].avatar = (ua && ua.avatar) || 'default';
    room.players[pi].game_character = (ua && ua.game_character) || 'stick';
  }

  // Attach map size to each player for dynamic spawn positions
  for (var mi = 0; mi < room.players.length; mi++) {
    room.players[mi].mapSize = room.mapSize;
  }

  var game = new BombermanGame(room.players, config, room.mapSize);
  room.game = game;

  // Build playerData for the game_start event
  var playerData = [];
  for (var j = 0; j < game.players.length; j++) {
    var gp = game.players[j];
    playerData.push({ id: gp.id, nickname: gp.nickname, x: gp.x, y: gp.y, color: gp.color, direction: gp.direction, alive: true, shielded: false, avatar: gp.avatar || 'default', game_character: gp.game_character || 'stick' });
  }
  io.to('g_' + room.code).emit('game_start', {
    map: game.map, players: playerData, gridSize: game.gridSize,
    theme: room.theme || 'default'
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
      state.theme = room.theme || 'default';
      io.to('g_' + room.code).emit('game_state', state);

      if (state.state === 'finished') { console.log('TICK: GAME OVER');
        clearInterval(tickInterval);
        var rankings = room.game.getRankings(); console.log('Rankings:', JSON.stringify(rankings));
        var winner = room.game.winner; console.log('Winner:', winner);
        var result = saveMatch(room, winner, rankings); console.log('Match saved:', result.matchId);
        room.lastResults = { rankings: rankings, matchId: result.matchId, scores: result.scores };
        io.to('g_' + room.code).emit('game_over', {
          winner: winner, matchId: result.matchId, rankings: rankings, scores: result.scores
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
  

  // Force end after 10 minutes - draw (same score for all alive players)
  setTimeout(function() {
    if (room.game && room.game.state === 'playing') {
      console.log('FORCE END: Game timed out (10 min)');
      room.game.state = 'finished';
      room.game.winner = null;
      // Set all alive players to rank 1 (tie)
      for (var ti = 0; ti < room.game.players.length; ti++) {
        var tp = room.game.players[ti];
        if (tp.alive) { tp.rank = 1; }
        else { tp.rank = 2; }
      }
      var rankings = room.game.getRankings();
      var result = saveMatch(room, null, rankings);
      room.lastResults = { rankings: rankings, matchId: result.matchId, scores: result.scores };
      io.to('g_' + room.code).emit('game_over', {
        winner: null, matchId: result.matchId, rankings: rankings, scores: result.scores
      });
      room.status = 'waiting';
      for (var ri = 0; ri < room.players.length; ri++) { room.players[ri].ready = false; }
    }
  }, 600000); // 10 minutes
}

function saveMatch(room, winnerId, rankings) {
  if (!rankings) rankings = [];
  var match = db.prepare("INSERT INTO matches (room_id, game_type, max_players, started_at, ended_at, duration_secs, status) VALUES (?, ?, ?, datetime('now'), datetime('now'), 0, 'finished')").run(room.code, "bomberman", room.maxPlayers);
  var matchId = match.lastInsertRowid;

  // Get kills from game engine
  var gameKills = {};
  if (room.game) {
    for (var gi = 0; gi < room.game.players.length; gi++) {
      var gp = room.game.players[gi];
      gameKills[gp.id] = { kills: gp.kills || 0, suicide: gp.suicide || false };
    }
  }

  for (var i = 0; i < room.players.length; i++) {
    var p = room.players[i];
    var rank = 4;
    for (var j = 0; j < rankings.length; j++) {
      if (rankings[j].id === p.userId) {
        rank = rankings[j].rank;
        break;
      }
    }
    var baseScore = SCORE_TABLE[rank] || -10;
    var kills = 0;
    var isSuicide = false;
    if (gameKills[p.userId]) {
      kills = gameKills[p.userId].kills;
      isSuicide = gameKills[p.userId].suicide;
    }
    var deaths = (rank > 1) ? 1 : 0; // Survivor (rank 1) has 0 deaths
    if (isSuicide) deaths = 1;
    var killBonus = kills * 5;
    var deathPenalty = deaths * 10;
    var totalScore = baseScore + killBonus - deathPenalty;

    db.prepare('INSERT INTO match_players (match_id, user_id, player_index, is_winner, kills, rating_change) VALUES (?, ?, ?, ?, ?, ?)')
      .run(matchId, p.userId, i, p.userId === winnerId ? 1 : 0, kills, totalScore);
    var sql = 'UPDATE users SET total_games = total_games + 1';
    if (p.userId === winnerId) { sql += ', wins = wins + 1'; }
    sql += ', rating = MAX(100, rating + ' + totalScore + ')';
    sql += ' WHERE id = ?';
    db.prepare(sql).run(p.userId);
  }
  // Build and return score data for the client
  var scores = [];
  for (var si = 0; si < room.players.length; si++) {
    var sp = room.players[si];
    var rank2 = 4;
    for (var sj = 0; sj < rankings.length; sj++) {
      if (rankings[sj].id === sp.userId) { rank2 = rankings[sj].rank; break; }
    }
    var gk = gameKills[sp.userId] || { kills: 0, suicide: false };
    var bs = SCORE_TABLE[rank2] || -10;
    var deathPenalty2 = (rank2 > 1 && !gk.suicide) ? 10 : 0;
    if (gk.suicide) deathPenalty2 = 10;
    scores.push({ userId: sp.userId, rank: rank2, kills: gk.kills, baseScore: bs, killBonus: gk.kills * 5, deathPenalty: deathPenalty2, ratingChange: bs + gk.kills * 5 - deathPenalty2 });
  }
  return { matchId: matchId, scores: scores };
}
// Clear lobby chat on startup (fresh start)
db.prepare("DELETE FROM chat_messages WHERE room = 'lobby'").run();
rooms.clear();
server.listen(config.PORT, function() {
  console.log('BoomArena running at http://localhost:' + config.PORT);
});
// multer error handler
app.use(function(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 2MB)' });
  if (err.message && err.message.indexOf('Only jpg') >= 0) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});
