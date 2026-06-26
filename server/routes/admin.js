const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const JWT_SECRET = 'boomarena_secret_2026';

router.post('/login', function(req, res) {
  var u = req.body.username;
  var p = req.body.password;
  if (u !== ADMIN_USER || p !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  var token = jwt.sign({ userId: 0, isAdmin: true }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ success: true, token: token });
});

function adminAuth(req, res, next) {
  var header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  var parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Bad format' });
  try {
    var payload = jwt.verify(parts[1], JWT_SECRET);
    if (!payload.isAdmin) return res.status(403).json({ error: 'Not admin' });
    req.adminId = payload.userId;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.get('/stats', adminAuth, function(req, res) {
  var userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  var matchCount = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
  var onlineCount = global.onlineUsersSize || 0;
  var recentMatches = db.prepare("SELECT COUNT(*) as c FROM matches WHERE started_at >= datetime('now', '-1 day')").get().c;
  res.json({ userCount: userCount, matchCount: matchCount, recentMatches: recentMatches, onlineCount: onlineCount });
});

router.get('/users', adminAuth, function(req, res) {
  var users = db.prepare('SELECT id, username, nickname, rating, total_games, wins, avatar, created_at, last_login FROM users ORDER BY id ASC LIMIT 100').all();
  res.json(users);
});

router.get('/announcements', function(req, res) {
  var list = db.prepare('SELECT content, created_at FROM announcements ORDER BY id DESC LIMIT 5').all();
  res.json(list);
});

router.post('/announcements', adminAuth, function(req, res) {
  var content = (req.body.content || '').trim();
  if (!content || content.length > 200) return res.status(400).json({ error: 'Content 1-200 chars' });
  db.prepare('INSERT INTO announcements (content) VALUES (?)').run(content);
  res.json({ success: true });
});

module.exports = router;
