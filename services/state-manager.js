const fs = require('fs').promises;
const path = require('path');

class StateManager {
  constructor(cacheFilePath) {
    this.cacheFilePath = cacheFilePath;
    this.state = {
      lastActivity: null,      // Время последней активности (обработанной заметки)
      lastCheck: null,         // Время последней проверки
      emptyChecksCount: 0,     // Количество пустых проверок подряд
      totalChecks: 0,          // Общее количество проверок
      totalNotesProcessed: 0,  // Общее количество обработанных заметок
      pageHash: null,          // Хеш последней загруженной страницы
      userNoteStates: {},      // Состояние заметок по пользователям
      lastCleanup: null        // Время последней очистки кеша
    };
  }

  async loadState() {
    try {
      // Создаем директорию если не существует
      const dir = path.dirname(this.cacheFilePath);
      await fs.mkdir(dir, { recursive: true });

      // Загружаем состояние из файла
      const data = await fs.readFile(this.cacheFilePath, 'utf8');
      const savedState = JSON.parse(data);
      
      // Мержим с дефолтным состоянием
      this.state = { ...this.state, ...savedState };
      
      console.log(`📂 Состояние загружено: ${Object.keys(this.state).length} полей`);
      
      // Показываем краткую статистику
      if (this.state.totalChecks > 0) {
        const lastActivity = this.state.lastActivity ? 
          new Date(this.state.lastActivity).toLocaleString() : 'никогда';
        const lastCheck = this.state.lastCheck ? 
          new Date(this.state.lastCheck).toLocaleString() : 'никогда';
          
        console.log(`📊 Статистика: Проверок ${this.state.totalChecks}, заметок ${this.state.totalNotesProcessed}`);
        console.log(`📅 Последняя активность: ${lastActivity}`);
        console.log(`🔍 Последняя проверка: ${lastCheck}`);
        console.log(`🚫 Пустых проверок подряд: ${this.state.emptyChecksCount}`);
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📂 Файл состояния не найден, создается новый');
      } else {
        console.warn('⚠️ Ошибка загрузки состояния:', error.message);
        console.log('📂 Используется дефолтное состояние');
      }
    }
  }

  async saveState() {
    try {
      const dir = path.dirname(this.cacheFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Добавляем timestamp сохранения
      const stateToSave = {
        ...this.state,
        lastSaved: Date.now()
      };
      
      await fs.writeFile(this.cacheFilePath, JSON.stringify(stateToSave, null, 2));
      console.log('💾 Состояние сохранено');
      
    } catch (error) {
      console.error('❌ Ошибка сохранения состояния:', error.message);
    }
  }

  getState() {
    return { ...this.state };
  }

  updateState(updates) {
    this.state = { ...this.state, ...updates };
  }

  // Методы для работы с пользовательскими состояниями заметок
  getUserNoteState(userId) {
    return this.state.userNoteStates[userId] || {};
  }

  updateUserNoteState(userId, noteId, snippet) {
    if (!this.state.userNoteStates[userId]) {
      this.state.userNoteStates[userId] = {};
    }
    this.state.userNoteStates[userId][noteId] = {
      snippet,
      lastProcessed: Date.now()
    };
  }

  hasUserNoteChanged(userId, noteId, currentSnippet) {
    const userState = this.getUserNoteState(userId);
    const savedNote = userState[noteId];
    
    if (!savedNote) {
      return true; // Новая заметка
    }
    
    return savedNote.snippet !== currentSnippet;
  }

  // Очистка старых данных
  async cleanup() {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней
    
    let cleanedCount = 0;
    
    // Очищаем старые состояния заметок
    for (const userId in this.state.userNoteStates) {
      const userNotes = this.state.userNoteStates[userId];
      
      for (const noteId in userNotes) {
        const note = userNotes[noteId];
        if (now - note.lastProcessed > maxAge) {
          delete userNotes[noteId];
          cleanedCount++;
        }
      }
      
      // Удаляем пустые объекты пользователей
      if (Object.keys(userNotes).length === 0) {
        delete this.state.userNoteStates[userId];
      }
    }
    
    this.state.lastCleanup = now;
    
    if (cleanedCount > 0) {
      console.log(`🧹 Очищено ${cleanedCount} старых записей заметок`);
      await this.saveState();
    }
    
    return cleanedCount;
  }

  // Проверяем, нужна ли очистка
  shouldCleanup() {
    const lastCleanup = this.state.lastCleanup || 0;
    const cleanupInterval = 24 * 60 * 60 * 1000; // Раз в день
    return (Date.now() - lastCleanup) > cleanupInterval;
  }

  // Получение статистики
  getStatistics() {
    const totalUserNotes = Object.values(this.state.userNoteStates)
      .reduce((sum, userNotes) => sum + Object.keys(userNotes).length, 0);
    
    return {
      totalChecks: this.state.totalChecks,
      totalNotesProcessed: this.state.totalNotesProcessed,
      emptyChecksCount: this.state.emptyChecksCount,
      totalTrackedNotes: totalUserNotes,
      lastActivity: this.state.lastActivity,
      lastCheck: this.state.lastCheck,
      lastCleanup: this.state.lastCleanup
    };
  }

  // Сброс статистики (для отладки)
  resetStatistics() {
    this.state.totalChecks = 0;
    this.state.totalNotesProcessed = 0;
    this.state.emptyChecksCount = 0;
    this.state.lastActivity = null;
    this.state.lastCheck = null;
    console.log('🔄 Статистика сброшена');
  }

  // Получение хеша страницы для определения изменений
  setPageHash(hash) {
    this.state.pageHash = hash;
  }

  hasPageChanged(currentHash) {
    return this.state.pageHash !== currentHash;
  }
}

module.exports = { StateManager }; 