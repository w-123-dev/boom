var express = require('express');
var db = require('../db');
var auth = require('../utils/jwt');
var router = express.Router();

router.get('/list', auth.authMiddleware, function(req, res) {
  var friends = db.prepare(
    "SELECT u.id, u.username, u.nickname, u.rating, " +
    "COALESCE(fr.remark, '') as remark " +
    "FROM friends f " +
    "JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?) " +
    "LEFT JOIN friend_remarks fr ON fr.user_id = ? AND fr.friend_id = u.id " +
    "WHERE f.status = 'accepted' AND u.id != ?"
  ).all(req.userId, req.userId, req.userId, req.userId);
  res.json(friends);
});

router.get('/requests', auth.authMiddleware, function(req, res) {
  var requests = db.prepare(
    "SELECT u.id, u.username, u.nickname, u.rating FROM friends f " +
    "JOIN users u ON f.user_id = u.id WHERE f.friend_id = ? AND f.status = 'pending'"
  ).all(req.userId);
  res.json(requests);
});

router.post('/request', auth.authMiddleware, function(req, res) {
  var fid = req.body.friendId;
  if (!fid) return res.status(400).json({ error: 'Missing friendId' });
  if (fid === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });
  var exists = db.prepare('SELECT id FROM users WHERE id = ?').get(fid);
  if (!exists) return res.status(404).json({ error: 'User not found' });
  var existing = db.prepare(
    "SELECT id, status FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
  ).get(req.userId, fid, fid, req.userId);
  if (existing) {
    if (existing.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
    return res.status(400).json({ error: 'Request already sent' });
  }
  db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)').run(req.userId, fid);
  res.json({ success: true });
});

router.post('/respond', auth.authMiddleware, function(req, res) {
  var fid = req.body.friendId;
  var accept = req.body.accept;
  if (!fid) return res.status(400).json({ error: 'Missing friendId' });
  var row = db.prepare("SELECT id FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'").get(fid, req.userId);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (accept) { db.prepare("UPDATE friends SET status = 'accepted' WHERE id = ?").run(row.id); }
  else { db.prepare('DELETE FROM friends WHERE id = ?').run(row.id); }
  res.json({ success: true });
});

router.post('/remove', auth.authMiddleware, function(req, res) {
  var fid = req.body.friendId;
  if (!fid) return res.status(400).json({ error: 'Missing friendId' });
  db.prepare("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)").run(req.userId, fid, fid, req.userId);
  res.json({ success: true });
});

router.post('/set-remark', auth.authMiddleware, function(req, res) {
  var fid = req.body.friendId;
  var remark = (req.body.remark || '').toString().substring(0, 20);
  if (!fid) return res.status(400).json({ error: 'Missing friendId' });
  var row = db.prepare("SELECT id FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'").get(req.userId, fid, fid, req.userId);
  if (!row) return res.status(404).json({ error: 'Friend not found' });
  db.prepare('INSERT OR REPLACE INTO friend_remarks (user_id, friend_id, remark) VALUES (?, ?, ?)').run(req.userId, fid, remark);
  res.json({ success: true });
});

module.exports = router;
