require('dotenv').config();

module.exports = {
  // Основные настройки
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
  usersFile: './data/users.json',
  logsFile: './data/logs.json',
  cacheFile: './data/cache.json',

  // Динамические интервалы проверки (в миллисекундах)
  intervals: {
    base: 5 * 60 * 1000,        // 5 минут - базовый интервал
    accelerated: 2 * 60 * 1000, // 2 минуты - при активности
    night: 20 * 60 * 1000,      // 20 минут - ночной режим
    maxInactive: 15 * 60 * 1000 // 15 минут - максимальный при неактивности
  },

  // Настройки активности
  activity: {
    recentWindowHours: 1,       // Окно активности в часах
    emptyChecksBeforeSlowdown: 5, // Пустых проверок до замедления
    maxEmptyChecks: 20          // Максимум пустых проверок подряд
  },

  // Ночной режим (время в часах, 24-часовой формат)
  nightMode: {
    startHour: 0,  // 00:00
    endHour: 7     // 07:00
  },

  // Оптимизированные настройки Puppeteer
  puppeteer: {
    launchOptions: {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-images',
        '--disable-javascript',
        '--memory-pressure-off',
        '--max_old_space_size=256',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      timeout: 10000
    },
    pageTimeout: 10000,
    navigationTimeout: 10000
  },

  // Мониторинг и логирование
  monitoring: {
    memoryLogInterval: 5 * 60 * 1000, // Логировать память каждые 5 минут
    maxLogEntries: 1000,              // Максимум записей в логе
    healthCheckInterval: 30 * 60 * 1000, // Проверка здоровья каждые 30 минут
    alertAfterInactiveMinutes: 30     // Уведомление если скрипт не работал 30 минут
  }
}; 