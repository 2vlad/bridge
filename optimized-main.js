const config = require('./optimized-config');
const { readUsers } = require('./services/users');
const { logEvent, logMemoryUsage } = require('./services/logger');
const { processUserNotesOptimized } = require('./services/lightphone-optimized');
const { StateManager } = require('./services/state-manager');
const { IntervalManager } = require('./services/interval-manager');

class OptimizedWorker {
  constructor() {
    this.stateManager = new StateManager(config.cacheFile);
    this.intervalManager = new IntervalManager(config);
    this.isRunning = false;
    this.timeoutId = null;
    this.stats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      notesProcessed: 0,
      startTime: Date.now(),
      lastSuccessfulCheck: null
    };
    
    this.setupGracefulShutdown();
    this.setupMonitoring();
  }

  async start() {
    if (this.isRunning) {
      console.log('Worker уже запущен');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Запуск оптимизированного Light Phone Worker');
    
    // Восстанавливаем состояние
    await this.stateManager.loadState();
    
    // Логируем начальное состояние памяти
    logMemoryUsage('worker:start');
    
    // Запускаем первую проверку
    this.scheduleNextCheck();
    
    logEvent(null, 'worker:started', { 
      message: 'Оптимизированный worker запущен',
      config: {
        baseInterval: config.intervals.base,
        nightMode: config.nightMode,
        puppeteerArgs: config.puppeteer.launchOptions.args.length
      }
    });
  }

  async stop() {
    console.log('🛑 Остановка worker...');
    this.isRunning = false;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Сохраняем состояние
    await this.stateManager.saveState();
    
    logEvent(null, 'worker:stopped', { 
      message: 'Worker остановлен',
      stats: this.stats 
    });
  }

  scheduleNextCheck() {
    if (!this.isRunning) return;

    const currentInterval = this.intervalManager.getCurrentInterval(
      this.stateManager.getState()
    );

    console.log(`⏰ Следующая проверка через ${Math.round(currentInterval / 1000 / 60)} минут`);
    
    logEvent(null, 'worker:scheduled', { 
      message: `Запланирована проверка через ${currentInterval}ms`,
      intervalMinutes: Math.round(currentInterval / 1000 / 60),
      reason: this.intervalManager.getLastReason()
    });

    this.timeoutId = setTimeout(() => {
      this.performCheck();
    }, currentInterval);
  }

  async performCheck() {
    if (!this.isRunning) return;

    const checkStartTime = Date.now();
    let memoryBefore, memoryAfter;
    
    try {
      memoryBefore = process.memoryUsage();
      logMemoryUsage('check:start', memoryBefore);
      
      console.log(`\n🔍 [${new Date().toISOString()}] Начало проверки заметок`);
      
      this.stats.totalChecks++;
      
      const allUsers = readUsers();
      const activeUsers = allUsers.filter(u => 
        u.settings?.lightPhoneEmail && 
        u.settings?.claudeApiKey &&
        u.settings?.deviceUrl
      );

      if (activeUsers.length === 0) {
        console.log('⚠️ Нет активных пользователей для проверки');
        this.updateStateAfterCheck(false, 0);
        this.scheduleNextCheck();
        return;
      }

      console.log(`👥 Обработка ${activeUsers.length} пользователей`);
      
      let totalNotesProcessed = 0;
      let hasNewActivity = false;

      for (const user of activeUsers) {
        try {
          logEvent(user.id, 'user:check:start', { 
            message: `Начало проверки пользователя ${user.email}` 
          });

          const result = await processUserNotesOptimized(user);
          
          if (result.notesProcessed > 0) {
            totalNotesProcessed += result.notesProcessed;
            hasNewActivity = true;
            this.stats.notesProcessed += result.notesProcessed;
            
            logEvent(user.id, 'user:check:success', { 
              message: `Обработано ${result.notesProcessed} заметок`,
              notesProcessed: result.notesProcessed
            });
          }
          
        } catch (error) {
          console.error(`❌ Ошибка при обработке пользователя ${user.email}:`, error.message);
          logEvent(user.id, 'user:check:error', { 
            result: 'error',
            message: error.message,
            stack: error.stack 
          });
        }
      }

      // Логируем память после обработки
      memoryAfter = process.memoryUsage();
      logMemoryUsage('check:end', memoryAfter);
      
      // Статистика по памяти
      const memoryDiff = {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed
      };

      const checkDuration = Date.now() - checkStartTime;
      
      console.log(`✅ Проверка завершена за ${checkDuration}ms`);
      console.log(`📊 Обработано ${totalNotesProcessed} заметок`);
      console.log(`💾 Память: RSS ${Math.round(memoryAfter.rss / 1024 / 1024)}MB (Δ${Math.round(memoryDiff.rss / 1024 / 1024)}MB)`);
      
      this.stats.successfulChecks++;
      this.stats.lastSuccessfulCheck = Date.now();
      
      this.updateStateAfterCheck(hasNewActivity, totalNotesProcessed);
      
      logEvent(null, 'worker:check:complete', {
        message: 'Проверка завершена успешно',
        duration: checkDuration,
        notesProcessed: totalNotesProcessed,
        usersChecked: activeUsers.length,
        memoryUsage: {
          rss: Math.round(memoryAfter.rss / 1024 / 1024),
          heapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024),
          rssDiff: Math.round(memoryDiff.rss / 1024 / 1024),
          heapDiff: Math.round(memoryDiff.heapUsed / 1024 / 1024)
        }
      });
      
    } catch (error) {
      console.error('❌ Критическая ошибка во время проверки:', error);
      this.stats.failedChecks++;
      
      logEvent(null, 'worker:check:critical_error', {
        result: 'error',
        message: error.message,
        stack: error.stack,
        duration: Date.now() - checkStartTime
      });
      
      this.updateStateAfterCheck(false, 0);
    }

    // Планируем следующую проверку
    this.scheduleNextCheck();
  }

  updateStateAfterCheck(hasActivity, notesProcessed) {
    const state = this.stateManager.getState();
    const now = Date.now();
    
    if (hasActivity) {
      state.lastActivity = now;
      state.emptyChecksCount = 0;
    } else {
      state.emptyChecksCount = (state.emptyChecksCount || 0) + 1;
    }
    
    state.lastCheck = now;
    state.totalChecks = (state.totalChecks || 0) + 1;
    state.totalNotesProcessed = (state.totalNotesProcessed || 0) + notesProcessed;
    
    this.stateManager.updateState(state);
  }

  setupGracefulShutdown() {
    const signals = ['SIGINT', 'SIGTERM'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n🔄 Получен сигнал ${signal}. Graceful shutdown...`);
        await this.stop();
        process.exit(0);
      });
    });
    
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught Exception:', error);
      logEvent(null, 'worker:uncaught_exception', {
        result: 'error',
        message: error.message,
        stack: error.stack
      });
      await this.stop();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      logEvent(null, 'worker:unhandled_rejection', {
        result: 'error',
        message: String(reason)
      });
    });
  }

  setupMonitoring() {
    // Периодическое логирование памяти
    const memoryMonitorInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(memoryMonitorInterval);
        return;
      }
      logMemoryUsage('monitor:periodic');
    }, config.monitoring.memoryLogInterval);

    // Проверка здоровья системы
    const healthCheckInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(healthCheckInterval);
        return;
      }
      this.performHealthCheck();
    }, config.monitoring.healthCheckInterval);
  }

  performHealthCheck() {
    const now = Date.now();
    const uptime = now - this.stats.startTime;
    const lastCheck = this.stats.lastSuccessfulCheck;
    
    // Проверяем, не слишком ли давно была последняя успешная проверка
    if (lastCheck && (now - lastCheck) > (config.monitoring.alertAfterInactiveMinutes * 60 * 1000)) {
      const minutesInactive = Math.round((now - lastCheck) / 60 / 1000);
      console.warn(`⚠️ ВНИМАНИЕ: Последняя успешная проверка была ${minutesInactive} минут назад`);
      
      logEvent(null, 'worker:health:inactive_warning', {
        message: `Worker неактивен ${minutesInactive} минут`,
        lastSuccessfulCheck: new Date(lastCheck).toISOString(),
        minutesInactive
      });
    }
    
    const healthStats = {
      uptime: Math.round(uptime / 1000 / 60), // в минутах
      totalChecks: this.stats.totalChecks,
      successRate: this.stats.totalChecks > 0 ? 
        Math.round((this.stats.successfulChecks / this.stats.totalChecks) * 100) : 0,
      notesProcessed: this.stats.notesProcessed,
      lastSuccessfulCheck: lastCheck ? new Date(lastCheck).toISOString() : null
    };
    
    console.log(`💓 Health Check: Uptime ${healthStats.uptime}m, Checks ${healthStats.totalChecks}, Success ${healthStats.successRate}%, Notes ${healthStats.notesProcessed}`);
    
    logEvent(null, 'worker:health:check', {
      message: 'Periodic health check',
      stats: healthStats,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    });
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      currentState: this.stateManager.getState(),
      nextCheckIn: this.timeoutId ? 'scheduled' : 'not_scheduled'
    };
  }
}

// Главная функция
async function main() {
  console.log('🎯 Light Phone <-> Claude Optimized Bridge');
  console.log('📊 Конфигурация:');
  console.log(`   • Базовый интервал: ${config.intervals.base / 1000 / 60} минут`);
  console.log(`   • Ускоренный режим: ${config.intervals.accelerated / 1000 / 60} минут`);
  console.log(`   • Ночной режим: ${config.intervals.night / 1000 / 60} минут (${config.nightMode.startHour}:00-${config.nightMode.endHour}:00)`);
  console.log(`   • Puppeteer аргументы: ${config.puppeteer.launchOptions.args.length} опций`);
  console.log('');

  const worker = new OptimizedWorker();
  
  // Экспортируем worker для возможного внешнего управления
  global.optimizedWorker = worker;
  
  await worker.start();
}

// Запускаем только если файл выполняется напрямую
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Критическая ошибка запуска:', error);
    process.exit(1);
  });
}

module.exports = { OptimizedWorker, main }; 