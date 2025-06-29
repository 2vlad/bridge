const puppeteer = require('puppeteer-core');
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

async function processUserNotesOptimized(user) {
  const { id: userId, settings } = user;
  const { lightPhoneEmail, lightPhonePassword, deviceUrl, trigger = '<', claudeApiKey } = settings;
  const sessionPath = `./session/${userId}`;

  let browser = null;
  let page = null;
  const startTime = Date.now();
  
  const result = {
    notesProcessed: 0,
    errors: [],
    duration: 0,
    memoryUsage: null
  };

  try {
    // Логируем начало обработки пользователя
    logEvent(userId, 'user:start', { 
      message: `Начало обработки пользователя ${user.email}`,
      trigger,
      deviceUrl 
    });

    // Запускаем браузер с оптимизированными настройками
    browser = await launchOptimizedBrowser(sessionPath, userId);
    page = await browser.newPage();
    
    // Настраиваем страницу для экономии ресурсов
    await setupPageOptimizations(page);

    // Логинимся если необходимо
    await performLoginIfNeeded(page, deviceUrl, lightPhoneEmail, lightPhonePassword, userId);

    // Переходим к заметкам
    await navigateToNotes(page, userId);

    // Проверяем хеш страницы для определения изменений
    const pageHash = await getPageHash(page);
    logEvent(userId, 'page:hash', { hash: pageHash.substring(0, 10) + '...' });

    // Обрабатываем заметки
    const notesFound = await processNotesOnPage(page, user, claudeApiKey);
    result.notesProcessed = notesFound;

    logEvent(userId, 'user:success', { 
      message: `Пользователь обработан успешно`,
      notesProcessed: result.notesProcessed,
      duration: Date.now() - startTime
    });

  } catch (error) {
    result.errors.push(error.message);
    
    logEvent(userId, 'user:error', { 
      result: 'error',
      message: error.message,
      stack: error.stack.split('\n').slice(0, 5).join('\n') // Ограничиваем stack trace
    });
    
    throw error;
    
  } finally {
    // Всегда закрываем браузер
    if (browser) {
      try {
        await browser.close();
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

async function launchOptimizedBrowser(sessionPath, userId) {
  const launchOptions = {
    ...config.puppeteer.launchOptions,
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

async function setupPageOptimizations(page) {
  // Устанавливаем таймауты
  page.setDefaultTimeout(config.puppeteer.pageTimeout);
  page.setDefaultNavigationTimeout(config.puppeteer.navigationTimeout);

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

async function performLoginIfNeeded(page, deviceUrl, email, password, userId) {
  logEvent(userId, 'navigation:start', { url: deviceUrl });
  
  await page.goto(deviceUrl, { 
    waitUntil: 'networkidle2',
    timeout: config.puppeteer.navigationTimeout 
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

async function navigateToNotes(page, userId) {
  logEvent(userId, 'navigation:notes:start', { message: 'Переход к заметкам' });
  
  const navigationSteps = [
    { xpath: SELECTORS.mainMenuPhoneLinkXPath, name: 'Phone menu' },
    { xpath: SELECTORS.phoneSelectionLinkXPath, name: 'Phone selection' },
    { xpath: SELECTORS.toolboxLinkXPath, name: 'Toolbox' },
    { xpath: SELECTORS.notesToolLinkXPath, name: 'Notes tool' },
    { xpath: SELECTORS.viewNotesLinkXPath, name: 'View Notes' }
  ];

  for (const step of navigationSteps) {
    try {
      const element = await page.waitForSelector(`xpath/${step.xpath}`, { 
        visible: true, 
        timeout: 5000 
      });
      
      await element.click();
      await page.waitForTimeout(2000); // Даем время на загрузку
      
      logEvent(userId, 'navigation:step', { 
        message: `Клик по ${step.name}`,
        step: step.name 
      });
      
    } catch (error) {
      logEvent(userId, 'navigation:step:skip', { 
        message: `${step.name} не найден, пропускаем`,
        step: step.name 
      });
      // Продолжаем, возможно этот шаг не нужен
    }
  }

  // Проверяем, что мы на странице заметок
  if (!page.url().includes('/tools/notes')) {
    throw new Error('Не удалось перейти к заметкам');
  }
  
  logEvent(userId, 'navigation:notes:success', { 
    message: 'Успешно перешли к заметкам',
    finalUrl: page.url() 
  });
}

async function processNotesOnPage(page, user, claudeApiKey) {
  const { id: userId, settings } = user;
  const trigger = settings.trigger || '<';
  
  // Ждем загрузки заметок
  await page.waitForSelector(SELECTORS.noteItem, { timeout: 10000 });
  
  const notes = await page.$$(SELECTORS.noteItem);
  logEvent(userId, 'notes:found', { 
    message: `Найдено ${notes.length} заметок`,
    count: notes.length 
  });

  let processedCount = 0;

  for (let i = 0; i < notes.length; i++) {
    const noteHandle = notes[i];
    
    try {
      const titleEl = await noteHandle.$(SELECTORS.noteTitle);
      if (!titleEl) continue;

      const title = await page.evaluate(el => el.textContent.trim(), titleEl);
      
      // Проверяем триггер
      if (!title.startsWith(trigger)) {
        continue;
      }

      logEvent(userId, 'note:triggered', { 
        message: `Найдена заметка с триггером: "${title.substring(0, 50)}..."`,
        title: title.substring(0, 50)
      });

      // Получаем ID заметки для отслеживания изменений
      const noteLink = await noteHandle.$('a');
      const noteId = noteLink ? 
        await page.evaluate(el => el.getAttribute('href'), noteLink) : `note_${i}`;

      const promptSnippet = title.substring(trigger.length).trim().slice(0, 15);
      
      // Здесь можно добавить проверку кеша заметок
      // const hasChanged = stateManager.hasUserNoteChanged(userId, noteId, promptSnippet);
      // if (!hasChanged) continue;

      // Обрабатываем заметку
      const processed = await processingleNote(page, noteHandle, title, claudeApiKey, userId);
      
      if (processed) {
        processedCount++;
        // stateManager.updateUserNoteState(userId, noteId, promptSnippet);
        
        logEvent(userId, 'note:processed', { 
          message: `Заметка обработана успешно`,
          noteId,
          title: title.substring(0, 50)
        });
        
        // Обрабатываем только одну заметку за раз для стабильности
        break;
      }
      
    } catch (error) {
      logEvent(userId, 'note:error', { 
        result: 'error',
        message: `Ошибка обработки заметки: ${error.message}`,
        index: i
      });
    }
  }

  return processedCount;
}

async function processingleNote(page, noteHandle, title, claudeApiKey, userId) {
  // Кликаем по заметке
  await noteHandle.click();
  
  try {
    await page.waitForSelector(SELECTORS.noteEditorTextarea, { 
      visible: true, 
      timeout: 10000 
    });
  } catch (error) {
    logEvent(userId, 'note:editor:timeout', { 
      message: 'Таймаут загрузки редактора заметки' 
    });
    return false;
  }

  // Получаем полный текст заметки
  const editorHandle = await page.$(SELECTORS.noteEditorTextarea);
  const fullText = await page.evaluate(el => el.value, editorHandle);

  // Проверяем, не обработана ли уже заметка
  if (fullText.includes('---')) {
    logEvent(userId, 'note:already_processed', { 
      message: 'Заметка уже содержит ответ' 
    });
    return false;
  }

  // Извлекаем промпт
  const triggerIndex = fullText.indexOf('<') !== -1 ? fullText.indexOf('<') : fullText.indexOf('>');
  if (triggerIndex === -1) {
    logEvent(userId, 'note:no_trigger', { message: 'Триггер не найден в тексте' });
    return false;
  }
  
  const prompt = fullText.substring(triggerIndex + 1).trim();
  
  logEvent(userId, 'note:processing', { 
    message: `Отправка в Claude: "${prompt.substring(0, 100)}..."`,
    promptLength: prompt.length
  });

  // Отправляем в Claude (здесь нужно импортировать сервис Claude)
  const { askClaude } = require('./claude');
  
  try {
    const claudeResponse = await askClaude({ id: userId, settings: { claudeApiKey }}, {
      prompt,
      systemPrompt: 'Ответь развернуто и полезно. Если вопрос на русском, но латиницей, ответь на русском.'
    });

    // Добавляем ответ к заметке
    const newText = `${fullText}\n\n---\n\n${claudeResponse}`;
    
    await page.evaluate((el, content) => {
      el.value = content;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, editorHandle, newText);

    // Сохраняем
    await page.click(SELECTORS.saveButton);
    
    // Ждем сохранения и возврата к списку
    try {
      await page.waitForSelector(SELECTORS.noteItem, { 
        visible: true, 
        timeout: 15000 
      });
    } catch (error) {
      // Если автоматический возврат не сработал, идем назад вручную
      await page.goBack({ waitUntil: 'networkidle2' });
      await page.waitForSelector(SELECTORS.noteItem, { 
        visible: true, 
        timeout: 10000 
      });
    }

    return true;
    
  } catch (error) {
    logEvent(userId, 'note:claude_error', { 
      result: 'error',
      message: `Ошибка Claude API: ${error.message}` 
    });
    return false;
  }
}

// Вспомогательная функция для вычисления хеша страницы
async function getPageHash(page) {
  const content = await page.content();
  return crypto.createHash('md5').update(content).digest('hex');
}

module.exports = { processUserNotesOptimized }; 