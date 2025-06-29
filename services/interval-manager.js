class IntervalManager {
  constructor(config) {
    this.config = config;
    this.lastReason = null; // Причина выбора последнего интервала
  }

  getCurrentInterval(state) {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Проверяем ночной режим
    if (this.isNightTime(currentHour)) {
      this.lastReason = `ночной режим (${currentHour}:00)`;
      return this.config.intervals.night;
    }
    
    // Проверяем недавнюю активность
    if (this.hasRecentActivity(state)) {
      this.lastReason = 'ускоренный режим - была активность в последний час';
      return this.config.intervals.accelerated;
    }
    
    // Адаптивный интервал на основе пустых проверок
    const adaptiveInterval = this.getAdaptiveInterval(state);
    if (adaptiveInterval > this.config.intervals.base) {
      this.lastReason = `адаптивный режим - ${state.emptyChecksCount || 0} пустых проверок`;
      return adaptiveInterval;
    }
    
    // Базовый интервал
    this.lastReason = 'базовый режим';
    return this.config.intervals.base;
  }

  isNightTime(currentHour) {
    const { startHour, endHour } = this.config.nightMode;
    
    if (startHour <= endHour) {
      // Обычный случай: 22:00 - 06:00
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Переход через полночь: 23:00 - 07:00
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  hasRecentActivity(state) {
    if (!state.lastActivity) {
      return false;
    }
    
    const now = Date.now();
    const activityWindowMs = this.config.activity.recentWindowHours * 60 * 60 * 1000;
    
    return (now - state.lastActivity) < activityWindowMs;
  }

  getAdaptiveInterval(state) {
    const emptyChecks = state.emptyChecksCount || 0;
    const { emptyChecksBeforeSlowdown, maxEmptyChecks } = this.config.activity;
    
    // Если меньше порога - используем базовый интервал
    if (emptyChecks < emptyChecksBeforeSlowdown) {
      return this.config.intervals.base;
    }
    
    // Линейное увеличение интервала
    const slowdownFactor = Math.min(
      (emptyChecks - emptyChecksBeforeSlowdown) / (maxEmptyChecks - emptyChecksBeforeSlowdown),
      1
    );
    
    const additionalTime = (this.config.intervals.maxInactive - this.config.intervals.base) * slowdownFactor;
    
    return Math.round(this.config.intervals.base + additionalTime);
  }

  getLastReason() {
    return this.lastReason;
  }

  // Вспомогательные методы для анализа
  getIntervalStatistics(state) {
    const currentInterval = this.getCurrentInterval(state);
    const now = new Date();
    
    return {
      currentInterval,
      currentIntervalMinutes: Math.round(currentInterval / 1000 / 60),
      reason: this.lastReason,
      currentHour: now.getHours(),
      isNightTime: this.isNightTime(now.getHours()),
      hasRecentActivity: this.hasRecentActivity(state),
      emptyChecksCount: state.emptyChecksCount || 0,
      lastActivity: state.lastActivity ? new Date(state.lastActivity).toISOString() : null,
      nextCheckEstimate: new Date(Date.now() + currentInterval).toISOString()
    };
  }

  // Предложения по оптимизации
  getOptimizationSuggestions(state) {
    const suggestions = [];
    const emptyChecks = state.emptyChecksCount || 0;
    const { maxEmptyChecks, emptyChecksBeforeSlowdown } = this.config.activity;
    
    if (emptyChecks > maxEmptyChecks) {
      suggestions.push({
        type: 'warning',
        message: `Очень много пустых проверок (${emptyChecks}). Возможно, пользователи неактивны.`
      });
    }
    
    if (emptyChecks > emptyChecksBeforeSlowdown * 2) {
      suggestions.push({
        type: 'optimization',
        message: 'Рассмотрите увеличение базового интервала для экономии ресурсов.'
      });
    }
    
    if (!state.lastActivity) {
      suggestions.push({
        type: 'info',
        message: 'Активность еще не зафиксирована. Система работает в режиме ожидания.'
      });
    } else {
      const daysSinceActivity = (Date.now() - state.lastActivity) / (24 * 60 * 60 * 1000);
      if (daysSinceActivity > 7) {
        suggestions.push({
          type: 'warning',
          message: `Последняя активность была ${Math.round(daysSinceActivity)} дней назад.`
        });
      }
    }
    
    return suggestions;
  }

  // Симуляция следующих интервалов для планирования
  simulateNextIntervals(state, count = 5) {
    const intervals = [];
    let currentState = { ...state };
    
    for (let i = 0; i < count; i++) {
      const interval = this.getCurrentInterval(currentState);
      const nextCheckTime = Date.now() + (interval * (i + 1));
      
      intervals.push({
        checkNumber: i + 1,
        interval,
        intervalMinutes: Math.round(interval / 1000 / 60),
        reason: this.lastReason,
        estimatedTime: new Date(nextCheckTime).toISOString()
      });
      
      // Симулируем пустую проверку для следующей итерации
      currentState = {
        ...currentState,
        emptyChecksCount: (currentState.emptyChecksCount || 0) + 1,
        lastCheck: nextCheckTime
      };
    }
    
    return intervals;
  }
}

module.exports = { IntervalManager }; 