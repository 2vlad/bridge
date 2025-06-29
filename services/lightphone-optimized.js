const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { logEvent } = require('./logger');
const config = require('../optimized-config');

// Улучшенные селекторы
const SELECTORS = {
  // Логин
  loginEmail: 'input[type="email"], input[id$="_email"][type="text"]',
  loginPassword: 'input[type="password"]',
  loginButton: 'button[type="submit"], label[for="login-submit"]',

  // Навигация (XPath для надежности)
  mainMenuPhoneLinkXPath: "//a[contains(@class, 'MainMenu__link') and @href='/devices']",
  phoneSelectionLinkXPath: "//body[//p[normalize-space(.)='Select a Phone']]//ul[contains(@class, 'MenuList')]//li[contains(@class, 'title')]",
  toolboxLinkXPath: "//ul[contains(@class, 'MenuList')]//li[normalize-space(.)='Toolbox']",
  notesToolLinkXPath: "//a[substring(@href, string-length(@href) - string-length('/tools/notes') + 1) = '/tools/notes']",
  viewNotesLinkXPath: "//a[./li[normalize-space(.)='View Notes']]",

  // Заметки
  noteItem: 'li.flex.flex-row',
  noteTitle: 'span.title',
  noteEditorTextarea: 'textarea.ember-text-area',
  saveButton: 'button[type="submit"]'
};

class OptimizedLightPhoneService {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    // Инициализация без запуска браузера - он будет запускаться для каждой проверки
    return true;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async checkNotes(user) {
    const { id: userId, settings } = user;
    const { lightPhoneEmail, lightPhonePassword, claudeApiKey } = settings;
    const sessionPath = `./session/${userId}`;
    const deviceUrl = 'https://dashboard.thelightphone.com/';

    const startTime = Date.now();
    
    const result = {
      success: false,
      notes: [],
      processedCount: 0,
      errors: [],
      duration: 0,
      memoryUsage: null
    };

    try {
      // Запускаем браузер для этой проверки
      this.browser = await this.launchOptimizedBrowser(sessionPath, userId);
      this.page = await this.browser.newPage();
      
      // Настраиваем страницу для экономии ресурсов
      await this.setupPageOptimizations(this.page);

      // Логинимся если необходимо
      await this.performLoginIfNeeded(this.page, deviceUrl, lightPhoneEmail, lightPhonePassword, userId);

      // Переходим к заметкам
      await this.navigateToNotes(this.page, userId);

      // Обрабатываем заметки
      const notesData = await this.processNotesOnPage(this.page, user, claudeApiKey);
      result.notes = notesData.notes;
      result.processedCount = notesData.processedCount;
      result.success = true;

      logEvent(userId, 'check:success', { 
        message: `Проверка завершена успешно`,
        notesFound: result.notes.length,
        processedCount: result.processedCount,
        duration: Date.now() - startTime
      });

    } catch (error) {
      result.errors.push(error.message);
      result.error = error.message;
      
      logEvent(userId, 'check:error', { 
        result: 'error',
        message: error.message,
        stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : 'Stack trace not available'
      });
      
    } finally {
      // Всегда закрываем браузер
      if (this.browser) {
        try {
          await this.browser.close();
          this.browser = null;
          this.page = null;
          logEvent(userId, 'browser:closed', { message: 'Браузер закрыт' });
        } catch (closeError) {
          logEvent(userId, 'browser:close_error', { 
            result: 'error',
            message: closeError.message 
          });
        }
      }

      result.duration = Date.now() - startTime;
      result.memoryUsage = process.memoryUsage();
    }

    return result;
  }

  async launchOptimizedBrowser(sessionPath, userId) {
    const launchOptions = {
      ...this.config.launchOptions,
      userDataDir: sessionPath
    };

    // В продакшен используем предустановленный браузер
    if (process.env.NODE_ENV === 'production') {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }

    logEvent(userId, 'browser:launch', { 
      message: 'Запуск оптимизированного браузера',
      headless: launchOptions.headless,
      argsCount: launchOptions.args.length
    });

    const memoryBefore = process.memoryUsage();
    const browser = await puppeteer.launch(launchOptions);
    const memoryAfter = process.memoryUsage();

    logEvent(userId, 'browser:launched', { 
      message: 'Браузер запущен',
      memoryDiff: Math.round((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024),
      currentMemory: Math.round(memoryAfter.rss / 1024 / 1024)
    });

    return browser;
  }

  async setupPageOptimizations(page) {
    // Устанавливаем таймауты
    page.setDefaultTimeout(this.config.pageTimeout);
    page.setDefaultNavigationTimeout(this.config.navigationTimeout);

    // Блокируем ненужные ресурсы для экономии трафика и скорости
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      // Блокируем изображения, шрифты, медиа
      if (['image', 'font', 'media', 'manifest'].includes(resourceType)) {
        request.abort();
        return;
      }
      
      // Блокируем аналитику и рекламу
      const url = request.url();
      if (url.includes('google-analytics') || 
          url.includes('googletagmanager') || 
          url.includes('facebook.net') ||
          url.includes('doubleclick')) {
        request.abort();
        return;
      }
      
      request.continue();
    });

    // Устанавливаем User-Agent для стабильности
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  async performLoginIfNeeded(page, deviceUrl, email, password, userId) {
    logEvent(userId, 'navigation:start', { url: deviceUrl });
    
    await page.goto(deviceUrl, { 
      waitUntil: 'networkidle2',
      timeout: this.config.navigationTimeout 
    });

    // Проверяем, нужен ли логин
    if (page.url().includes('/login')) {
      logEvent(userId, 'login:required', { message: 'Требуется логин' });
      
      await page.waitForSelector(SELECTORS.loginEmail, { visible: true, timeout: 5000 });
      await page.type(SELECTORS.loginEmail, email, { delay: 50 });
      await page.type(SELECTORS.loginPassword, password, { delay: 50 });
      await page.click(SELECTORS.loginButton);
      
      // Ждем завершения логина
      await page.waitForFunction(
        () => !window.location.href.includes('/login'), 
        { timeout: 30000 }
      );
      
      logEvent(userId, 'login:success', { message: 'Логин успешен' });
    } else {
      logEvent(userId, 'login:skipped', { message: 'Уже авторизован' });
    }
  }

  async navigateToNotes(page, userId) {
    const navigationSteps = [
      { xpath: SELECTORS.mainMenuPhoneLinkXPath, name: 'Главное меню "Phone"' },
      { xpath: SELECTORS.phoneSelectionLinkXPath, name: 'Выбор телефона' },
      { xpath: SELECTORS.toolboxLinkXPath, name: 'Toolbox' },
      { xpath: SELECTORS.notesToolLinkXPath, name: 'Notes tool' },
      { xpath: SELECTORS.viewNotesLinkXPath, name: 'View Notes' }
    ];

    for (const step of navigationSteps) {
      try {
        const [element] = await page.$x(step.xpath);
        if (!element) {
          logEvent(userId, 'navigation:step:skip', { 
            message: `${step.name} не найден, пропускаем`,
            step: step.name 
          });
          continue;
        }
        
        await element.click();
        await page.waitForTimeout(2000);
        
        logEvent(userId, 'navigation:step', { 
          message: `Клик по ${step.name}`,
          step: step.name 
        });
        
      } catch (error) {
        logEvent(userId, 'navigation:step:skip', { 
          message: `${step.name} не найден, пропускаем`,
          step: step.name 
        });
      }
    }

    if (!page.url().includes('/tools/notes')) {
      throw new Error('Не удалось перейти к заметкам');
    }
    
    logEvent(userId, 'navigation:notes:success', { 
      message: 'Успешно перешли к заметкам',
      finalUrl: page.url() 
    });
  }

  async processNotesOnPage(page, user, claudeApiKey) {
    const { id: userId, settings } = user;
    const trigger = settings.trigger || '<';
    
    // Ждем загрузки заметок
    await page.waitForSelector(SELECTORS.noteItem, { timeout: 10000 });
    
    const notes = await page.$$(SELECTORS.noteItem);
    logEvent(userId, 'notes:found', { 
      message: `Найдено ${notes.length} заметок`,
      count: notes.length 
    });

    const notesData = [];
    let processedCount = 0;

    for (let i = 0; i < notes.length; i++) {
      const noteHandle = notes[i];
      
      try {
        const titleEl = await noteHandle.$(SELECTORS.noteTitle);
        if (!titleEl) continue;

        const title = await page.evaluate(el => el.textContent.trim(), titleEl);
        
        const noteData = {
          title,
          needsProcessing: title.startsWith(trigger)
        };
        notesData.push(noteData);
        
        // Проверяем триггер
        if (!title.startsWith(trigger)) {
          continue;
        }

        logEvent(userId, 'note:triggered', { 
          message: `Найдена заметка с триггером: "${title.substring(0, 50)}..."`,
          title: title.substring(0, 50)
        });

        // Здесь можно добавить обработку заметки
        // const processed = await this.processNote(page, noteHandle, title, claudeApiKey, userId);
        // if (processed) processedCount++;
        
      } catch (error) {
        logEvent(userId, 'note:error', { 
          result: 'error',
          message: `Ошибка обработки заметки: ${error.message}`,
          index: i
        });
      }
    }

    return { notes: notesData, processedCount };
  }
}

module.exports = { OptimizedLightPhoneService }; 