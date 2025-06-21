const puppeteer = require('puppeteer');

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

async function processUserNotes({ lightPhoneEmail, lightPhonePassword, deviceUrl, trigger = '<', sessionPath = './session' }, handleNote) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], userDataDir: sessionPath });
  const page = await browser.newPage();
  try {
    await page.goto(deviceUrl, { waitUntil: 'networkidle2' });
    // Логин
    if (await page.$(SELECTORS.loginEmail)) {
      await page.type(SELECTORS.loginEmail, lightPhoneEmail);
      await page.type(SELECTORS.loginPassword, lightPhonePassword);
      await page.click(SELECTORS.loginButton);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
    // Открыть список заметок
    await page.waitForSelector(SELECTORS.notesList, { timeout: 15000 });
    const notes = await page.$$(SELECTORS.noteItem);
    for (const note of notes) {
      const titleEl = await note.$(SELECTORS.noteTitle);
      const title = await page.evaluate(el => el.textContent, titleEl);
      if (title.trim().startsWith(trigger)) {
        await note.click();
        await page.waitForSelector(SELECTORS.noteEditor, { timeout: 10000 });
        const editor = await page.$(SELECTORS.noteEditor);
        const text = await page.evaluate(el => el.value, editor);
        const updated = await handleNote({ title, text, page, editor });
        if (updated) {
          await page.click(SELECTORS.saveButton);
          await page.waitForTimeout(1000);
        }
        await page.goBack();
      }
    }
  } finally {
    await browser.close();
  }
}

module.exports = { processUserNotes }; 