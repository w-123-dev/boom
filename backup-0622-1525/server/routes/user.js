const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../utils/jwt');

const router = express.Router();

router.get('/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, avatar, rating, total_games, wins, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  user.win_rate = user.total_games > 0 ? (user.wins / user.total_games * 100).toFixed(1) : 0;
  res.json(user);
});

router.get('/leaderboard', (req, res) => {
  const users = db.prepare('SELECT id, username, nickname, rating, wins, total_games FROM users ORDER BY rating DESC LIMIT 50').all();
  res.json(users);
});

router.get('/search', authMiddleware, (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  const users = db.prepare('SELECT id, username, nickname, rating FROM users WHERE (username LIKE ? OR nickname LIKE ?) AND id != ? LIMIT 20').all(`%${q}%`, `%${q}%`, req.userId);
  res.json(users);
});


router.get('/matches', authMiddleware, (req, res) => {
  const matches = db.prepare('SELECT m.id, m.game_type, m.started_at, mp.is_winner, mp.kills FROM matches m JOIN match_players mp ON mp.match_id = m.id WHERE mp.user_id = ? ORDER BY m.started_at DESC LIMIT 20').all(req.userId);
  res.json(matches);
});

module.exports = router;
