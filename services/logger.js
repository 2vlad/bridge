const fs = require('fs');
const { logsFile } = require('../config');

function readLogs() {
  if (!fs.existsSync(logsFile)) return [];
  return JSON.parse(fs.readFileSync(logsFile, 'utf8'));
}

function writeLogs(logs) {
  // Ротация: оставляем только последние 1000 записей
  const rotatedLogs = logs.slice(-1000);
  fs.writeFileSync(logsFile, JSON.stringify(rotatedLogs, null, 2));
}

function logEvent(userId, action, data = {}) {
  const logs = readLogs();
  logs.push({
    timestamp: new Date().toISOString(),
    userId,
    action,
    result: data.result,
    message: data.message,
  });
  writeLogs(logs);
}

module.exports = {
  readLogs,
  logEvent,
}; 