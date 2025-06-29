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
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    result: data.result,
    message: data.message,
    ...data  // Включаем все дополнительные данные
  };
  logs.push(logEntry);
  writeLogs(logs);
  console.log(JSON.stringify(logEntry));
}

function logMemoryUsage(context, memoryData = null) {
  const memory = memoryData || process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memory.rss / 1024 / 1024),
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
    external: Math.round(memory.external / 1024 / 1024)
  };
  
  logEvent(null, 'memory:usage', {
    message: `Использование памяти: ${context}`,
    context,
    memory: memoryMB,
    timestamp: new Date().toISOString()
  });
  
  return memoryMB;
}

module.exports = {
  readLogs,
  logEvent,
  logMemoryUsage,
}; 