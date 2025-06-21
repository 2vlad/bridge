require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
  usersFile: './data/users.json',
  logsFile: './data/logs.json',
  workerInterval: 2 * 60 * 1000, // 2 минуты
}; 