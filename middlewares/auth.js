const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { logEvent } = require('../services/logger');
const { verifyToken, findUserById } = require('../services/users');

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logEvent(null, 'auth:fail', { result: 'error', message: 'No authorization header' });
    return res.status(401).json({ message: 'Auth error: no token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    logEvent(null, 'auth:fail', { result: 'error', message: 'Malformed authorization header' });
    return res.status(401).json({ message: 'Auth error: no token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }
    // eslint-disable-next-line no-unused-vars
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    logEvent(req.user.id, 'auth:success');
    next();
  } catch (error) {
    logEvent(null, 'auth:fail', { result: 'error', message: error.message });
    return res.status(401).json({ message: 'Auth error: invalid token' });
  }
}

module.exports = auth; 