const { readUsers } = require('./services/users');
const { logEvent } = require('./services/logger');
const { processUserNotes } = require('./services/lightphone');
const { askClaude } = require('./services/claude');
const { workerInterval } = require('./config');

let intervalId = null;

async function processAllUsers() {
  console.log('Worker: Starting processing cycle...');
  const users = readUsers().filter(u => 
    u.settings?.lightPhoneEmail && u.settings?.claudeApiKey
  );

  for (const user of users) {
    try {
      console.log(`Worker: Processing user ${user.id}`);
      await processUserNotes(user.settings, async ({ title, text, page, editor }) => {
        // Проверяем, есть ли уже ответ
        if (text.includes('---')) return false;

        const prompt = text.replace(user.settings.trigger || '<', '').trim();
        const claudeResponse = await askClaude({
          prompt,
          apiKey: user.settings.claudeApiKey,
          systemPrompt: 'Ответь максимально кратко, 3-4 предложения. Если вопрос на русском, но латиницей, ответь на русском.'
        });

        const newText = `${text}\n\n---\n\n${claudeResponse}`;
        await page.evaluate((el, content) => el.value = content, editor, newText);
        
        logEvent(user.id, 'note_processed', { result: 'success', message: `Note "${title}" processed.` });
        return true; // Обновляем заметку
      });
    } catch (error) {
      console.error(`Worker: Error processing user ${user.id}:`, error.message);
      logEvent(user.id, 'note_processed', { result: 'error', message: error.message });
    }
  }
  console.log('Worker: Processing cycle finished.');
}

function start() {
  if (intervalId) return;
  console.log(`Worker: Started, will run every ${workerInterval / 1000}s`);
  processAllUsers(); // Запускаем сразу
  intervalId = setInterval(processAllUsers, workerInterval);
}

function stop() {
  if (!intervalId) return;
  console.log('Worker: Stopped.');
  clearInterval(intervalId);
  intervalId = null;
}

module.exports = { start, stop }; 