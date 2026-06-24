const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(userId) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: '登录已过期' });
  }
  req.userId = payload.userId;
  next();
}

module.exports = { signToken, verifyToken, authMiddleware };
