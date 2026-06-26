requireAuth();
var urlParams = new URLSearchParams(window.location.search);
var roomCode = urlParams.get('code');
if (!roomCode) window.location.href = '/';

var canvas = document.getElementById('gameCanvas');
var renderer = new GameRenderer(canvas, 40);
var user = JSON.parse(localStorage.getItem('user') || '{}');
var myUserId = user.id;
var myDead = false;

document.getElementById('soundToggleBtn').onclick = function() {
  var on = SoundFX.toggle();
  this.textContent = on ? '\ud83d\udd0a Sound ON' : '\ud83d\udd07 Sound OFF';
};
var gameEnded = false;

var socket = io({
  auth: { token: localStorage.getItem('token') },
  transports: ['websocket', 'polling']
});

// No client-side timeout - game duration depends on players' actions
socket.on('connect', function() {
  socket.emit('join_game', { code: roomCode });
  // Hide reconnect overlay on any connect (including reconnection)
  var ro = document.getElementById('reconnectOverlay');
  if (ro) ro.classList.add('hidden');
  if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
});

// Track reconnection countdown
var reconnectTimer = null;

socket.on('disconnect', function() {
  if (gameEnded) return;
  var overlay = document.getElementById('reconnectOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  var countdown = 30;
  var cdEl = document.getElementById('reconnectCountdown');
  if (reconnectTimer) clearInterval(reconnectTimer);
  reconnectTimer = setInterval(function() {
    countdown--;
    if (cdEl) cdEl.textContent = countdown;
    if (countdown <= 0) clearInterval(reconnectTimer);
  }, 1000);
});

socket.io.on('reconnect', function() {
  if (gameEnded) return;
  var overlay = document.getElementById('reconnectOverlay');
  if (overlay) overlay.classList.add('hidden');
  if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
});

var prevExplosions = 0;
var prevPowerups = 0;
var gameSoundStarted = false;

socket.on('game_state', function(state) {
  if (gameEnded) return;
  if (!gameSoundStarted && state.state === 'playing') { gameSoundStarted = true; SoundFX.gameStart(); }
  if (!renderer.mapWidth && state.map) {
    renderer.init(state.map[0].length, state.map.length);
    if (state.theme) renderer.setTheme(state.theme);
  }
  
  if (state.explosions && state.explosions.length > prevExplosions) { SoundFX.explode(); }
  prevExplosions = state.explosions ? state.explosions.length : 0;
  renderer.render(state);
  if (state.powerups && state.powerups.length < prevPowerups) { SoundFX.powerup(); }
  prevPowerups = state.powerups ? state.powerups.length : 0;
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
        SoundFX.death();
        showDeathOptions(state);
      }
    }
  }
});

socket.on('game_over', function(data) {
  gameEnded = true;
  if (data.winner === null || data.winner === undefined) { SoundFX.gameOver(); }
  else if (data.winner === myUserId) { SoundFX.victory(); } else { SoundFX.gameOver(); }
  showSettlement(data.rankings || [], data.scores || []);
});

function showDeathOptions(state) {
  var aliveCount = 0;
  for (var i = 0; i < state.players.length; i++) {
    if (state.players[i].alive) aliveCount++;
  }
  var overlay = document.getElementById('gameOverOverlay');
  overlay.classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.6)';
  document.getElementById('gameResult').textContent = '☠ 你已死亡';
  document.getElementById('gameWinner').innerHTML = '👥 剩余 ' + aliveCount + ' 人';
  if (aliveCount > 0) {
    document.getElementById('backBtn').classList.remove('hidden');
    document.getElementById('backBtn').innerHTML = '👁 观战';
    document.getElementById('backBtn').onclick = function() {
      overlay.classList.add('hidden');
    };
    document.getElementById('leaveBtn').classList.remove('hidden');
    document.getElementById('leaveBtn').innerHTML = '🚪 离开对局';
    document.getElementById('leaveBtn').onclick = function() {
      window.location.href = '/room.html?code=' + roomCode;
    };
  }
}

function showSettlement(rankings, scores) {
  var overlay = document.getElementById('gameOverOverlay');
  overlay.classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.8)';
  var html = '';
  for (var i = 0; i < rankings.length; i++) {
    var r = rankings[i];
    var medal = ['🥇','🥈','🥉','🌟'][r.rank-1] || (r.rank+'th');
    // Find matching score data from server
    var sc = null;
    for (var si = 0; si < scores.length; si++) {
      if (scores[si].userId === r.id) { sc = scores[si]; break; }
    }
    html += '<div style="padding:8px 14px;margin:4px;background:rgba(15,52,96,0.6);border-radius:8px;font-size:14px;text-align:left;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span style="font-weight:bold;">' + medal + ' ' + r.nickname + '</span>';
    if (sc) {
      var total = sc.ratingChange;
      html += ' <span style="color:' + (total >= 0 ? '#66bb6a' : '#ef5350') + ';font-weight:bold;font-size:16px;">' + (total >= 0 ? '+' : '') + total + '</span>';
    }
    html += '</div>';
    if (sc) {
      html += '<div style="font-size:12px;color:#8899aa;margin-top:2px;">';
      html += '排名分 ' + (sc.baseScore >= 0 ? '+' : '') + sc.baseScore;
      if (sc.killBonus > 0) html += ' · 击杀 +' + sc.killBonus;
      if (sc.deathPenalty > 0) html += ' · 死亡 -' + sc.deathPenalty;
      html += '</div>';
    }
    html += '</div>';
  }
  // Check for draw (all rank 1 = tie)
  var isDraw = true;
  for (var ri = 0; ri < rankings.length; ri++) {
    if (rankings[ri].rank !== 1) { isDraw = false; break; }
  }
  // Rebuild with correct medals if draw
  if (isDraw) {
    html = '';
    for (var di = 0; di < rankings.length; di++) {
      var dr = rankings[di];
      var sc2 = null;
      for (var sj = 0; sj < scores.length; sj++) {
        if (scores[sj].userId === dr.id) { sc2 = scores[sj]; break; }
      }
      html += '<div style="padding:8px 14px;margin:4px;background:rgba(15,52,96,0.6);border-radius:8px;font-size:14px;text-align:left;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-weight:bold;">🤝 ' + dr.nickname + '</span>';
      if (sc2) {
        html += ' <span style="color:' + (sc2.ratingChange >= 0 ? '#66bb6a' : '#ef5350') + ';font-weight:bold;font-size:16px;">' + (sc2.ratingChange >= 0 ? '+' : '') + sc2.ratingChange + '</span>';
      }
      html += '</div>';
      if (sc2) {
        html += '<div style="font-size:12px;color:#8899aa;margin-top:2px;">';
        html += '排名分 ' + (sc2.baseScore >= 0 ? '+' : '') + sc2.baseScore;
        if (sc2.killBonus > 0) html += ' · 击杀 +' + sc2.killBonus;
        if (sc2.deathPenalty > 0) html += ' · 死亡 -' + sc2.deathPenalty;
        html += '</div>';
      }
      html += '</div>';
    }
  }
  document.getElementById('gameResult').innerHTML = isDraw ? '🤝 平局' : '🏆 游戏结束';
  document.getElementById('gameWinner').innerHTML = html;
  document.getElementById('backBtn').classList.add('hidden');
  document.getElementById('leaveBtn').classList.remove('hidden');
  document.getElementById('leaveBtn').innerHTML = '🛠 返回房间';
  document.getElementById('leaveBtn').onclick = function() {
    window.location.href = '/room.html?code=' + roomCode;
  };
}

document.addEventListener('keydown', function(e) {
  if (myDead || gameEnded) return;
  var dirMap = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
  if (dirMap[e.code]) { e.preventDefault(); socket.emit('game_input', { dir: dirMap[e.code], pressed: true }); }
  if (e.code === 'Space') { e.preventDefault(); SoundFX.bomb();
    socket.emit('plant_bomb'); }
    if (e.code === 'KeyM') { e.preventDefault(); var _on = SoundFX.toggle(); var _btn = document.getElementById('soundToggleBtn'); if (_btn) _btn.textContent = _on ? '🔊 Sound ON' : '🔇 Sound OFF'; }
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
    if (p.disconnected) html += ' [disconnected]';
    if (p.alive) {
      if (p.shielded) html += ' [shield]';
      if (p.speed > 1) html += ' [fast]';
    }
    html += '</div>';
  }
  html += '<div class="hud-player">Alive: ' + aliveCount + '/' + state.players.length + '</div>';
  if (state.elapsed !== undefined) {
    var secs = Math.floor(state.elapsed / 1000);
    var mins = Math.floor(secs / 60);
    secs = secs % 60;
    var timeStr = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    html += '<div class="hud-player" style="background:#1a1a2e;">' + timeStr + '</div>';
  }
  hud.innerHTML = html;
}

function backToLobby() { window.location.href = '/'; }
