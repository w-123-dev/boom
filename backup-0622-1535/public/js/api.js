const API = {
  async request(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); }
};

function requireAuth() {
  if (!localStorage.getItem('token')) {
    window.location.href = '/login.html';
  }
}

const userData = JSON.parse(localStorage.getItem('user') || '{}');
