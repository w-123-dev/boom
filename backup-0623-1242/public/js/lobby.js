requireAuth();
var user = JSON.parse(localStorage.getItem('user') || '{}');
document.getElementById('userDisplay').textContent = user.nickname || user.username;
document.getElementById('ratingDisplay').textContent = user.rating || 1000;

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
    html += '<span class="user-tag">' + users[i].nickname + '</span>';
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
    html += '<div class="room-meta">' + r.playerCount + '/' + r.maxPlayers + ' players' + (r.hasPassword ? ' locked' : '') + '</div></div>';
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
