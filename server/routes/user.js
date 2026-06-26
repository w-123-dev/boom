const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { authMiddleware } = require('../utils/jwt');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars'),
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname) || '.png';
    cb(null, 'avatar_' + req.userId + '_' + Date.now() + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    var allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    var ext = path.extname(file.originalname).toLowerCase();
    if (allowed.indexOf(ext) >= 0) return cb(null, true);
    cb(new Error('Only jpg/png/gif/webp allowed'));
  }
});

router.get('/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, avatar, game_character, rating, total_games, wins, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  user.win_rate = user.total_games > 0 ? (user.wins / user.total_games * 100).toFixed(1) : 0;
  res.json(user);
});

router.get('/leaderboard', (req, res) => {
  const users = db.prepare('SELECT id, username, nickname, rating, wins, total_games FROM users ORDER BY rating DESC LIMIT 50').all();
  res.json(users);
});

router.get('/public/:id', authMiddleware, (req, res) => {
  var id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  var user = db.prepare('SELECT id, username, nickname, avatar, game_character, rating, total_games, wins FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.win_rate = user.total_games > 0 ? (user.wins / user.total_games * 100).toFixed(1) : 0;
  res.json(user);
});

router.get('/search', authMiddleware, (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  const users = db.prepare('SELECT id, username, nickname, rating FROM users WHERE (username LIKE ? OR nickname LIKE ?) AND id != ? LIMIT 20').all(`%${q}%`, `%${q}%`, req.userId);
  res.json(users);
});

router.get('/matches', authMiddleware, (req, res) => {
  const matches = db.prepare('SELECT m.id, m.game_type, mp.is_winner, mp.kills, mp.rating_change FROM matches m JOIN match_players mp ON mp.match_id = m.id WHERE mp.user_id = ? ORDER BY m.id DESC LIMIT 20').all(req.userId);
  res.json(matches);
});

router.post('/update-nickname', authMiddleware, function(req, res) {
  var nickname = req.body.nickname;
  if (!nickname || nickname.length < 2 || nickname.length > 16) {
    return res.status(400).json({ error: '昵称长度2-16个字符' });
  }
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, req.userId);
  res.json({ success: true, nickname: nickname });
});

router.post('/update-avatar', authMiddleware, upload.single('avatar'), function(req, res) {
  if (req.file) {
    var avatarPath = '/uploads/avatars/' + req.file.filename;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, req.userId);
    return res.json({ success: true, avatar: avatarPath, isCustom: true });
  }
  var avatar = req.body.avatar;
  var valid = ['default','circle','square','triangle'];
  if (valid.indexOf(avatar) < 0) return res.status(400).json({ error: 'Invalid avatar' });
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.userId);
  res.json({ success: true, avatar: avatar, isCustom: false });
});


router.post('/update-character', authMiddleware, function(req, res) {
  var character = req.body.character;
  var valid = ['stick','circle','square','triangle'];
  if (valid.indexOf(character) < 0) return res.status(400).json({ error: 'Invalid character' });
  db.prepare('UPDATE users SET game_character = ? WHERE id = ?').run(character, req.userId);
  res.json({ success: true, character: character });
});


router.post('/change-password', authMiddleware, function(req, res) {
  var oldPwd = req.body.oldPassword;
  var newPwd = req.body.newPassword;
  if (!oldPwd || !newPwd) return res.status(400).json({ error: '请输入旧密码和新密码' });
  if (newPwd.length < 4) return res.status(400).json({ error: '新密码至少4位' });

  var user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  var bcrypt = require('bcryptjs');
  if (!bcrypt.compareSync(oldPwd, user.password_hash)) {
    return res.status(401).json({ error: '旧密码错误' });
  }

  var hash = bcrypt.hashSync(newPwd, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.userId);
  res.json({ success: true });
});

module.exports = router;
