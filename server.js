const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const usersService = require('./services/users');
const logger = require('./services/logger');
const auth = require('./middlewares/auth');
// Проверяем, запускать ли оптимизированный режим
const useOptimized = process.env.OPTIMIZED_MODE === 'true' || process.argv.includes('--optimized');
const worker = useOptimized ? require('./optimized-main') : require('./worker');

// --- Убедимся, что папка для данных существует ---
if (!fs.existsSync(config.usersFile.substring(0, config.usersFile.lastIndexOf('/')))) {
  fs.mkdirSync(config.usersFile.substring(0, config.usersFile.lastIndexOf('/')), { recursive: true });
}

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для логгирования всех запросов к API
app.use('/api', (req, res, next) => {
  logger.logEvent(req.user ? req.user.id : null, 'request:received', {
    result: 'info',
    message: `${req.method} ${req.originalUrl}`,
  });
  next();
});

// --- API Routes ---
app.post('/api/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }
    const user = usersService.createUser({ email, password, name });
    const token = usersService.generateToken(user);
    logger.logEvent(user.id, 'register', { result: 'success' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    logger.logEvent(null, 'register:fail', { result: 'error', message: error.message });
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = usersService.findUserByEmail(email);
    if (!user || !usersService.verifyPassword(user, password)) {
      logger.logEvent(user ? user.id : null, 'login:fail', { result: 'error', message: 'Invalid credentials' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = usersService.generateToken(user);
    logger.logEvent(user.id, 'login', { result: 'success' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    logger.logEvent(null, 'login:fail', { result: 'error', message: error.message });
    next(error);
  }
});

app.get('/api/profile', auth, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/profile', auth, (req, res, next) => {
  try {
    const { lightPhoneEmail, lightPhonePassword, deviceUrl, claudeApiKey } = req.body;
    const updatedUser = usersService.updateUser(req.user.id, {
      settings: { ...req.user.settings, lightPhoneEmail, lightPhonePassword, deviceUrl, claudeApiKey }
    });
    logger.logEvent(req.user.id, 'profile_update', { result: 'success' });
    res.json({ user: updatedUser });
  } catch (error) {
    logger.logEvent(req.user.id, 'profile_update:fail', { result: 'error', message: error.message });
    next(error);
  }
});

app.get('/api/stats', auth, (req, res) => {
  const userLogs = logger.readLogs().filter(log => log.userId === req.user.id && log.action === 'note_processed' && log.result === 'success');
  res.json({ processedNotes: userLogs.length });
});

app.get('/api/logs', auth, (req, res) => {
  const userLogs = logger.readLogs().filter(log => log.userId === req.user.id);
  res.json({ logs: userLogs.slice(-50) }); // последние 50 логов
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// --- Оптимизированные API endpoints ---
app.get('/api/optimized/stats', auth, (req, res) => {
  if (!useOptimized || !global.optimizedWorker) {
    return res.status(404).json({ message: 'Оптимизированный режим не активен' });
  }
  
  const stats = global.optimizedWorker.getStats();
  res.json(stats);
});

app.get('/api/optimized/intervals', auth, (req, res) => {
  if (!useOptimized || !global.optimizedWorker) {
    return res.status(404).json({ message: 'Оптимизированный режим не активен' });
  }
  
  const state = global.optimizedWorker.stateManager.getState();
  const intervalStats = global.optimizedWorker.intervalManager.getIntervalStatistics(state);
  const nextChecks = global.optimizedWorker.intervalManager.simulateNextIntervals(state, 5);
  const suggestions = global.optimizedWorker.intervalManager.getOptimizationSuggestions(state);
  
  res.json({
    current: intervalStats,
    nextChecks,
    suggestions
  });
});

app.get('/api/optimized/memory', auth, (req, res) => {
  const currentMemory = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(currentMemory.rss / 1024 / 1024),
    heapUsed: Math.round(currentMemory.heapUsed / 1024 / 1024),
    heapTotal: Math.round(currentMemory.heapTotal / 1024 / 1024),
    external: Math.round(currentMemory.external / 1024 / 1024)
  };
  
  // Получаем историю памяти из логов
  const memoryLogs = logger.readLogs()
    .filter(log => log.action === 'memory:usage')
    .slice(-20)
    .map(log => ({
      timestamp: log.timestamp,
      context: log.context,
      memory: log.memory
    }));
  
  res.json({
    current: memoryMB,
    history: memoryLogs,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/optimized/cleanup', auth, async (req, res) => {
  if (!useOptimized || !global.optimizedWorker) {
    return res.status(404).json({ message: 'Оптимизированный режим не активен' });
  }
  
  try {
    const cleaned = await global.optimizedWorker.stateManager.cleanup();
    res.json({ 
      message: `Очищено ${cleaned} записей`,
      cleaned 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Ошибка очистки',
      error: error.message 
    });
  }
});


// --- Frontend ---
// Раздаём статику из папки front (для Next.js build)
app.use(express.static(path.join(__dirname, 'front', 'out')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'front', 'out', 'index.html'));
});

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
  logger.logEvent(req.user ? req.user.id : null, 'error:unhandled', {
    result: 'error',
    message: err.message,
    stack: err.stack,
  });
  res.status(500).json({ message: 'Internal Server Error' });
});

// --- Server & Worker ---
const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
  if (useOptimized) {
    console.log('🚀 Запуск в оптимизированном режиме');
    // Для оптимизированного режима worker запускается отдельно
    if (worker.main) {
      worker.main().catch(console.error);
    }
  } else {
    console.log('📊 Запуск в стандартном режиме');
    worker.start();
  }
});

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  if (useOptimized && global.optimizedWorker) {
    global.optimizedWorker.stop().then(() => {
      server.close(() => {
        console.log('HTTP server closed');
      });
    });
  } else {
    worker.stop();
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
}); 