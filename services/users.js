const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { usersFile, jwtSecret } = require('../config');

function readUsers() {
  if (!fs.existsSync(usersFile)) return [];
  return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function findUserByEmail(email) {
  return readUsers().find(u => u.email === email);
}

function findUserById(id) {
  return readUsers().find(u => u.id === id);
}

function createUser({ email, password, name }) {
  const users = readUsers();
  if (users.find(u => u.email === email)) throw new Error('User already exists');
  const id = Date.now().toString();
  const hash = bcrypt.hashSync(password, 8);
  const user = { id, email, password: hash, name, settings: {}, created: new Date().toISOString() };
  users.push(user);
  writeUsers(users);
  return user;
}

function updateUser(id, data) {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], ...data };
  writeUsers(users);
  return users[idx];
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = {
  readUsers,
  writeUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  verifyPassword,
  generateToken,
  verifyToken,
}; 