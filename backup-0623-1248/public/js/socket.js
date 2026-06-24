let socket = null;

function connectSocket() {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect_error', (err) => {
    console.error('Socket 连接失败:', err.message);
  });

  socket.on('disconnect', () => {
    console.log('Socket 断开');
  });
}

function initSocket() {
  const token = localStorage.getItem('token');
  if (!token) return;
  connectSocket();
}
