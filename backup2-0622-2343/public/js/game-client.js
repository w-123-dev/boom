requireAuth();
var urlParams = new URLSearchParams(window.location.search);
var roomCode = urlParams.get('code');
if (!roomCode) window.location.href = '/';

var canvas = document.getElementById('gameCanvas');
var renderer = new GameRenderer(canvas, 40);
var user = JSON.parse(localStorage.getItem('user') || '{}');
var myUserId = user.id;
var myDead = false;
var gameEnded = false;
var scoreTable = [0, 20, 10, -5, -10];

var socket = io({
  auth: { token: localStorage.getItem('token') },
  transports: ['websocket', 'polling']
});

// Fallback: show emergency return button after 60 seconds
var emergencyTimer = setTimeout(function() {
  if (!gameEnded) {
    var overlay = document.getElementById('gameOverOverlay');
    overlay.classList.remove('hidden');
    overlay.style.background = 'rgba(0,0,0,0.75)';
    document.getElementById('gameResult').textContent = 'Game stalled';
    document.getElementById('gameWinner').innerHTML = 'Something went wrong. Return to lobby?';
    document.getElementById('backBtn').classList.add('hidden');
    document.getElementById('leaveBtn').classList.remove('hidden');
    document.getElementById('leaveBtn').textContent = 'Back to Lobby';
    document.getElementById('leaveBtn').onclick = function() { window.location.href = '/'; };
  }
}, 60000);
socket.on('connect', function() {
  socket.emit('join_game', { code: roomCode });
});

socket.on('game_state', function(state) {
  if (gameEnded) return;
  if (!renderer.mapWidth && state.map) {
    renderer.init(state.map[0].length, state.map.length);
  }
  renderer.render(state);
  updateHUD(state);

  if (state.state === 'finished') {
    gameEnded = true;
    socket.emit('request_results', { code: roomCode });
    return;
  }

  if (!myDead && state.players) {
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === myUserId && !state.players[i].alive) {
        myDead = true;
        showDeathOptions(state);
      }
    }
  }
});

socket.on('game_over', function(data) {
  gameEnded = true;
  showSettlement(data.rankings || []);
});

function showDeathOptions(state) {
  var aliveCount = 0;
  for (var i = 0; i < state.players.length; i++) {
    if (state.players[i].alive) aliveCount++;
  }
  var overlay = document.getElementById('gameOverOverlay');
  overlay.classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.5)';
  document.getElementById('gameResult').textContent = 'You Died';
  document.getElementById('gameWinner').innerHTML = 'Remaining: ' + aliveCount + ' players';
  if (aliveCount > 0) {
    document.getElementById('backBtn').classList.remove('hidden');
    document.getElementById('backBtn').textContent = 'Spectate';
    document.getElementById('backBtn').onclick = function() {
      overlay.classList.add('hidden');
    };
    document.getElementById('leaveBtn').classList.remove('hidden');
    document.getElementById('leaveBtn').textContent = 'Leave Game';
    document.getElementById('leaveBtn').onclick = function() {
      window.location.href = '/room.html?code=' + roomCode;
    };
  }
}

function showSettlement(rankings) {
  var overlay = document.getElementById('gameOverOverlay');
  overlay.classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.75)';
  var html = '<div style="font-size:18px;margin-bottom:8px;">Results</div>';
  for (var i = 0; i < rankings.length; i++) {
    var r = rankings[i];
    var medal = ['1st','2nd','3rd','4th'][r.rank-1] || (r.rank+'th');
    var score = scoreTable[r.rank] || -10;
    html += '<div style="padding:4px 12px;margin:3px;background:#0f3460;border-radius:6px;">';
    html += medal + '. ' + r.nickname;
    html += ' <span style="color:' + (score >= 0 ? '#66bb6a' : '#ef5350') + '">' + (score >= 0 ? '+' : '') + score + '</span>';
    html += '</div>';
  }
  document.getElementById('gameResult').textContent = 'Game Over';
  document.getElementById('gameWinner').innerHTML = html;
  document.getElementById('backBtn').classList.add('hidden');
  document.getElementById('leaveBtn').classList.remove('hidden');
  document.getElementById('leaveBtn').textContent = 'Return to Room';
  document.getElementById('leaveBtn').onclick = function() {
    window.location.href = '/room.html?code=' + roomCode;
  };
}

document.addEventListener('keydown', function(e) {
  if (myDead || gameEnded) return;
  var dirMap = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
  if (dirMap[e.code]) { e.preventDefault(); socket.emit('game_input', { dir: dirMap[e.code], pressed: true }); }
  if (e.code === 'Space') { e.preventDefault(); socket.emit('plant_bomb'); }
});

document.addEventListener('keyup', function(e) {
  if (myDead || gameEnded) return;
  var dirMap = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
  if (dirMap[e.code]) { e.preventDefault(); socket.emit('game_input', { dir: dirMap[e.code], pressed: false }); }
});

function updateHUD(state) {
  var hud = document.getElementById('hud');
  if (!state || !state.players) return;
  var aliveCount = 0;
  var html = '';
  for (var i = 0; i < state.players.length; i++) {
    var p = state.players[i];
    if (p.alive) aliveCount++;
    html += '<div class="hud-player">';
    html += '<span class="dot" style="background:' + p.color + '"></span>';
    html += p.nickname + (p.id === myUserId ? ' (you)' : '');
    html += p.alive ? ' alive' : ' dead';
    if (p.alive) {
      if (p.shielded) html += ' [shield]';
      if (p.speed > 1) html += ' [fast]';
    }
    html += '</div>';
  }
  html += '<div class="hud-player">Alive: ' + aliveCount + '/' + state.players.length + '</div>';
  hud.innerHTML = html;
}

function backToLobby() { window.location.href = '/'; }
