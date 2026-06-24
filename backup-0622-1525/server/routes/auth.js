const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken } = require('../utils/jwt');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password || !nickname) {
    return res.status(400).json({ error: '请填写所有字段' });
  }
  if (username.length < 2 || username.length > 16) {
    return res.status(400).json({ error: '用户名长度2-16个字符' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少4位' });
  }
  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: '用户名已存在' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)').run(username, hash, nickname);
    const token = signToken(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, username, nickname, rating: 1000 } });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, rating: user.rating, total_games: user.total_games, wins: user.wins }
  });
});

module.exports = router;
