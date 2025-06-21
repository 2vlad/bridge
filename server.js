const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const usersService = require('./services/users');
const logger = require('./services/logger');
const auth = require('./middlewares/auth');
const worker = require('./worker');

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
  worker.start();
});

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  worker.stop();
  server.close(() => {
    console.log('HTTP server closed');
  });
}); 