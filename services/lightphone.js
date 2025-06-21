const puppeteer = require('puppeteer');
const { logEvent } = require('./logger');

const SELECTORS = {
  loginEmail: 'input[type="email"]',
  loginPassword: 'input[type="password"]',
  loginButton: 'button[type="submit"]',
  notesList: '.notes-list',
  noteItem: '.note-item',
  noteTitle: '.note-title',
  noteEditor: 'textarea',
  saveButton: '.save-btn'
};

async function processUserNotes(user, handleNote) {
  const { id: userId, settings } = user;
  const { lightPhoneEmail, lightPhonePassword, deviceUrl, trigger = '<' } = settings;
  const sessionPath = `./session/${userId}`; // User-specific session

  logEvent(userId, 'lp:start', { message: 'Launching browser' });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], userDataDir: sessionPath });
  const page = await browser.newPage();
  try {
    logEvent(userId, 'lp:navigate:login', { message: `Navigating to ${deviceUrl}` });
    await page.goto(deviceUrl, { waitUntil: 'networkidle2' });

    if (await page.$(SELECTORS.loginEmail)) {
      logEvent(userId, 'lp:login:attempt', { message: 'Login form found, attempting to log in.' });
      await page.type(SELECTORS.loginEmail, lightPhoneEmail);
      await page.type(SELECTORS.loginPassword, lightPhonePassword);
      await page.click(SELECTORS.loginButton);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      logEvent(userId, 'lp:login:success', { message: 'Login successful.' });
    } else {
      logEvent(userId, 'lp:login:skipped', { message: 'User already logged in.' });
    }

    logEvent(userId, 'lp:notes:wait', { message: 'Waiting for notes list to appear.' });
    await page.waitForSelector(SELECTORS.notesList, { timeout: 15000 });
    logEvent(userId, 'lp:notes:found', { message: 'Notes list found.' });

    const notes = await page.$$(SELECTORS.noteItem);
    logEvent(userId, 'lp:notes:scan', { message: `Found ${notes.length} notes. Scanning for trigger '${trigger}'.` });

    for (const note of notes) {
      const titleEl = await note.$(SELECTORS.noteTitle);
      const title = await page.evaluate(el => el.textContent, titleEl);
      if (title.trim().startsWith(trigger)) {
        logEvent(userId, 'lp:note:triggered', { message: `Found triggered note: "${title}"` });
        await note.click();

        logEvent(userId, 'lp:note:view', { message: 'Viewing note details.' });
        await page.waitForSelector(SELECTORS.noteEditor, { timeout: 10000 });
        const editor = await page.$(SELECTORS.noteEditor);
        const text = await page.evaluate(el => el.value, editor);
        logEvent(userId, 'lp:note:read', { message: `Read note content (length: ${text.length})` });

        const updated = await handleNote({ title, text, page, editor });

        if (updated) {
          logEvent(userId, 'lp:note:save', { message: 'Saving updated note.' });
          await page.click(SELECTORS.saveButton);
          await page.waitForTimeout(1000);
        } else {
          logEvent(userId, 'lp:note:skip_save', { message: 'handleNote returned false, not saving.' });
        }
        
        logEvent(userId, 'lp:note:goback', { message: 'Going back to notes list.' });
        await page.goBack({ waitUntil: 'networkidle2' });
        await page.waitForSelector(SELECTORS.notesList, { timeout: 15000 });
      }
    }
  } catch (error) {
    logEvent(userId, 'lp:error', { result: 'error', message: error.message, stack: error.stack });
    throw error; // Re-throw to be caught by the worker
  } finally {
    logEvent(userId, 'lp:end', { message: 'Closing browser.' });
    await browser.close();
  }
}

module.exports = { processUserNotes }; 