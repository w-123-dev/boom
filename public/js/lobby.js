requireAuth();
var user = JSON.parse(localStorage.getItem('user') || '{}');
document.getElementById('userDisplay').textContent = user.nickname || user.username;
document.getElementById('ratingDisplay').textContent = user.rating || 1000;
// Fetch fresh profile data to update rating after games
fetch('/api/user/profile', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.rating) {
      document.getElementById('ratingDisplay').textContent = data.rating;
      // Also update localStorage
      var u = JSON.parse(localStorage.getItem('user') || '{}');
      u.rating = data.rating;
      u.total_games = data.total_games;
      u.wins = data.wins;
      localStorage.setItem('user', JSON.stringify(u));
    }
  })
  .catch(function(e) { console.log('Profile fetch error:', e); });

document.getElementById('logoutBtn').onclick = function(e) {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
};

initSocket();

var rooms = [];

socket.on('online_users', function(users) {
  document.getElementById('onlineCount').textContent = users.length;
  var html = '';
  for (var i = 0; i < users.length; i++) {
    html += '<span class="user-tag" data-id="' + users[i].id + '" onclick="showUserCard(' + users[i].id + ')">' + users[i].nickname + '</span>';
  }
  document.getElementById('onlineList').innerHTML = html;
});

socket.on('lobby_chat', function(data) {
  var msgs = document.getElementById('chatMessages');
  var div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = '<span class="name">' + data.user + '</span>: ' + data.msg;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
});

document.getElementById('chatSendBtn').onclick = sendChat;
document.getElementById('chatInput').onkeydown = function(e) { if (e.key === 'Enter') sendChat(); };

function sendChat() {
  var input = document.getElementById('chatInput');
  var msg = input.value.trim();
  if (!msg) return;
  socket.emit('lobby_chat', msg);
  input.value = '';
}

socket.on('room_list', function(list) {
  rooms = list;
  renderRooms();
});

socket.on('room_created', function(room) {
  rooms.push(room);
  renderRooms();
});

socket.on('room_updated', function(data) {
  for (var i = 0; i < rooms.length; i++) {
    if (rooms[i].code === data.code) {
      rooms[i].playerCount = data.playerCount;
      rooms[i].status = data.status;
      if (data.mapSize) rooms[i].mapSize = data.mapSize;
      if (data.theme) rooms[i].theme = data.theme;
      break;
    }
  }
  renderRooms();
});

socket.on('room_removed', function(code) {
  var newRooms = [];
  for (var i = 0; i < rooms.length; i++) {
    if (rooms[i].code !== code) newRooms.push(rooms[i]);
  }
  rooms = newRooms;
  renderRooms();
});

socket.on('join_result', function(data) {
  if (data.success) {
    window.location.href = '/room.html?code=' + data.code;
  } else {
    alert(data.error || 'Failed');
  }
});

socket.on('redirect_to_room', function(data) {
  window.location.href = '/room.html?code=' + data.code;
});

function renderRooms() {
  var list = document.getElementById('roomList');
  if (rooms.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#666;padding:20px;">No rooms yet. Create one!</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < rooms.length; i++) {
    var r = rooms[i];
    html += '<div class="room-card">';
    html += '<div class="room-info"><div class="room-id">Room ' + r.code + '</div>';
    var lock = r.hasPassword ? ' 🔒' : '';
    var size = r.mapSize ? ' ' + r.mapSize + '×' + r.mapSize : '';
    var themeIcons = { default: '🏚️', ice: '🧊', volcano: '🌋' };
    var themeIcon = themeIcons[r.theme] || '🏚️';
    html += '<div class="room-meta">' + r.playerCount + '/' + r.maxPlayers + ' players' + lock + size + ' ' + themeIcon + '</div></div>';
    html += '<div class="room-actions"><button onclick="joinRoom(\'' + r.code + '\')">Join</button></div>';
    html += '</div>';
  }
  list.innerHTML = html;
}

document.getElementById('createRoomBtn').onclick = function() {
  socket.emit('create_room', { gameType: 'bomberman', maxPlayers: 4 });
};

document.getElementById('joinRoomBtn').onclick = function() {
  var code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code) joinRoom(code);
};

document.getElementById('roomCodeInput').onkeydown = function(e) {
  if (e.key === 'Enter') document.getElementById('joinRoomBtn').click();
};

function joinRoom(code) {
  socket.emit('join_room', { code: code });
}

socket.emit('request_room_list');

// ===== Friends System =====
var pmTarget = null;

var fl = document.getElementById('friendsLink');
if (fl) {
  fl.onclick = function(e) {
    e.preventDefault();
    var fv = document.getElementById('friendsView');
    var lg = document.querySelector('.lobby-grid');
    if (fv.classList.contains('hidden')) {
      fv.classList.remove('hidden');
      lg.classList.add('hidden');
      loadFriends();
    } else {
      fv.classList.add('hidden');
      lg.classList.remove('hidden');
    }
  };
}

function loadFriends() {
  var t = localStorage.getItem('token');
  fetch('/api/friends/list', {headers:{'Authorization':'Bearer '+t}})
    .then(function(r){return r.json()})
    .then(function(d){renderFriends(d)}).catch(function(){});
  fetch('/api/friends/requests', {headers:{'Authorization':'Bearer '+t}})
    .then(function(r){return r.json()})
    .then(function(d){renderRequests(d)}).catch(function(){});
}

function renderFriends(list) {
  var el = document.getElementById('friendList');
  if (!el) return;
  if (!list || list.length === 0) { el.innerHTML = '<div style="color:#666;padding:12px;font-size:13px;">No friends</div>'; return; }
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    var dn = f.remark || f.nickname;
    html += '<div style="padding:8px 10px;background:#0f3460;border-radius:8px;margin-bottom:4px;font-size:13px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    html += '<span><b style="cursor:pointer;" onclick="showUserCard(' + f.id + ')">' + dn + '</b> <span style="color:#888;font-size:11px;">(' + f.nickname + ')</span></span>';
    html += '<span>' + f.rating + 'pts</span></div>';
    html += '<div style="display:flex;gap:4px;">';
    html += '<button onclick="openPM(' + f.id + ')" style="padding:2px 8px;font-size:11px;">Chat</button>';
    html += '<button onclick="editRemark(' + f.id + ')" style="padding:2px 8px;font-size:11px;">Remark</button>';
    html += '<button onclick="removeFriend(' + f.id + ')" style="padding:2px 8px;font-size:11px;background:#555;">Remove</button></div></div>';
  }
  el.innerHTML = html;
}

function editRemark(fid) {
  var remark = prompt('Enter remark (cancel to clear):');
  if (remark === null) return;
  var t = localStorage.getItem('token');
  fetch('/api/friends/set-remark', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}, body:JSON.stringify({friendId:fid, remark:remark})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.success)loadFriends();else alert(d.error);})
    .catch(function(e){alert(e.message);});
}
function renderRequests(list) {
  var el = document.getElementById('friendRequests');
  if (!el) return;
  if (!list || list.length === 0) { el.innerHTML = ''; return; }
  var html = '<div style=\"font-size:13px;color:#ffd54f;margin-bottom:6px;\">好友请求</div>';
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    html += '<div style=\"padding:6px 8px;background:#0f3460;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;font-size:13px;\">';
    html += '<span>' + r.nickname + '</span>';
    html += '<button onclick=\"respondFR(' + r.id + ',true)\" style=\"padding:3px 8px;font-size:11px;\">接受</button>';
    html += '<button onclick=\"respondFR(' + r.id + ',false)\" style=\"padding:3px 8px;font-size:11px;background:#555;\">拒绝</button></div>';
  }
  el.innerHTML = html;
}

var sb = document.getElementById('friendSearchBtn');
if (sb) {
  sb.onclick = function() {
    var q = document.getElementById('friendSearchInput').value.trim();
    if (!q) return;
    var t = localStorage.getItem('token');
    fetch('/api/user/search?q=' + encodeURIComponent(q), {headers:{'Authorization':'Bearer '+t}})
      .then(function(r){return r.json()})
      .then(function(users){
        var el = document.getElementById('friendSearchResults');
        if (!users || users.length === 0) { el.innerHTML = '<div style=\"color:#666;font-size:13px;\">未找到</div>'; return; }
        var html = '';
        for (var i = 0; i < users.length; i++) {
          var u = users[i];
          html += '<div style=\"padding:6px 8px;background:#0f3460;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;font-size:13px;\">';
          html += '<span style="cursor:pointer;" onclick="showUserCard(' + u.id + ')">' + u.nickname + '</span>';
          html += '<button onclick=\"sendFR(' + u.id + ')\" style=\"padding:3px 8px;font-size:11px;\">加好友</button></div>';
        }
        el.innerHTML = html;
      }).catch(function(){});
  };
}

function sendFR(fid) {
  var t = localStorage.getItem('token');
  fetch('/api/friends/request', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}, body:JSON.stringify({friendId:fid})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.error){alert(d.error);return;}alert('请求已发送');document.getElementById('friendSearchResults').innerHTML='';document.getElementById('friendSearchInput').value='';})
    .catch(function(e){alert(e.message);});
}

function respondFR(fid, accept) {
  var t = localStorage.getItem('token');
  fetch('/api/friends/respond', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}, body:JSON.stringify({friendId:fid,accept:accept})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.success)loadFriends();else alert(d.error);})
    .catch(function(e){alert(e.message);});
}

function removeFriend(fid) {
  if (!confirm('删除好友？')) return;
  var t = localStorage.getItem('token');
  fetch('/api/friends/remove', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}, body:JSON.stringify({friendId:fid})})
    .then(function(r){return r.json()})
    .then(function(d){if(d.success)loadFriends();else alert(d.error);})
    .catch(function(e){alert(e.message);});
}

// PM functions
function openPM(fid, fname) {
  pmTarget = fid;
  var title = fname || 'Chat';
  var panel = document.getElementById('pmPanel');
  if (!panel) { console.log('pmPanel not found'); return; }
  document.getElementById('pmTitle').textContent = title;
  document.getElementById('pmMessages').innerHTML = '';
  panel.classList.remove('hidden');
  var pmRoom = user.id < fid ? user.id + '_' + fid : fid + '_' + user.id;
  socket.emit('request_chat_history', {room:'pm_' + pmRoom});
  var inp = document.getElementById('pmInput');
  if (inp) inp.focus();
}

function closePM() { pmTarget = null; document.getElementById('pmPanel').classList.add('hidden'); }

// Send PM
document.getElementById('pmSendBtn').onclick = sendPM;
document.getElementById('pmInput').onkeydown = function(e) { if (e.key === 'Enter') sendPM(); };

function sendPM() {
  if (!pmTarget) return;
  var inp = document.getElementById('pmInput');
  var msg = inp.value.trim();
  if (!msg) return;
  socket.emit('private_msg', {targetId: pmTarget, msg: msg});
  inp.value = '';
}

// Socket events
socket.on('private_msg', function(d) {
  if (pmTarget && (d.from === pmTarget || d.sent)) {
    var el = document.getElementById('pmMessages');
    var div = document.createElement('div');
    div.style.cssText = 'margin:3px 0;';
    if (d.sent) { div.style.textAlign = 'right'; div.innerHTML = '<span style=\"color:#888;\">我: </span>' + d.msg; }
    else { div.innerHTML = '<span style=\"color:#4fc3f7;\">' + d.fromName + ': </span>' + d.msg; }
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }
});

socket.on('private_msg_error', function(m) { alert(m); });

// Chat history handler
socket.on('chat_history', function(d) {
  if (d.room === 'lobby') {
    var el = document.getElementById('chatMessages');
    if (!el) return;
    el.innerHTML = '';
    for (var i = 0; i < d.messages.length; i++) {
      var m = d.messages[i];
      var div = document.createElement('div');
      div.className = 'chat-msg';
      div.innerHTML = '<span class=\"name\">' + m.user_name + '</span>: ' + m.message;
      el.appendChild(div);
    }
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (d.room.indexOf('pm_') === 0 && pmTarget) {
    var el2 = document.getElementById('pmMessages');
    if (!el2) return;
    el2.innerHTML = '';
    for (var j = 0; j < d.messages.length; j++) {
      var m2 = d.messages[j];
      var div2 = document.createElement('div');
      div2.style.cssText = 'margin:3px 0;';
      if (m2.user_name === user.nickname) {
        div2.style.textAlign = 'right';
        div2.innerHTML = '<span style=\"color:#888;\">我: </span>' + m2.message;
      } else {
        div2.innerHTML = '<span style=\"color:#4fc3f7;\">' + m2.user_name + ': </span>' + m2.message;
      }
      el2.appendChild(div2);
    }
    el2.scrollTop = el2.scrollHeight;
  }
});

// Request lobby history on reconnect
socket.on('connect', function() {
  socket.emit('request_chat_history', { room: 'lobby' });

// Load announcements
fetch('/api/admin/announcements').then(function(r){return r.json()}).then(function(list){
  var bar = document.getElementById('announcementBar');
  if (!bar) return;
  if (list && list.length > 0) {
    bar.textContent = '📢 ' + list[0].content;
    bar.style.display = 'block';
  }
}).catch(function(){});
  socket.emit('request_room_list');
});

// Also request chat history on page load
socket.emit('request_chat_history', { room: 'lobby' });

// User card popup
function showUserCard(userId) {
  if (!userId) return;
  var modal = document.getElementById('userCardModal');
  if (!modal) return;
  var tok = localStorage.getItem('token');
  var myId = (JSON.parse(localStorage.getItem('user') || '{}')).id;
  fetch('/api/user/public/' + userId, { headers: { 'Authorization': 'Bearer ' + tok } })
    .then(function(r){ return r.json(); })
    .then(function(u) {
      document.getElementById('cardNickname').textContent = u.nickname;
      document.getElementById('cardUsername').textContent = '@' + u.username;
      document.getElementById('cardRating').textContent = u.rating;
      document.getElementById('cardWins').textContent = u.wins;
      document.getElementById('cardWinRate').textContent = u.win_rate + '%';
      document.getElementById('cardInviteBtn').style.display = 'none';
      modal.classList.remove('hidden');
    })
    .catch(function(e) { console.log('Card error:', e); });
}
