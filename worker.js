const { readUsers } = require('./services/users');
const { logEvent } = require('./services/logger');
const { processUserNotes } = require('./services/lightphone');
const { askClaude } = require('./services/claude');
const { workerInterval } = require('./config');

let intervalId = null;

async function processAllUsers() {
  logEvent(null, 'worker:cycle:start');
  const allUsers = readUsers();
  const usersToProcess = allUsers.filter(u => 
    u.settings?.lightPhoneEmail && u.settings?.claudeApiKey
  );

  logEvent(null, 'worker:scan', { message: `Found ${allUsers.length} total users. Processing ${usersToProcess.length}.` });

  for (const user of usersToProcess) {
    try {
      logEvent(user.id, 'worker:user:start', { message: `Processing user ${user.email}` });
      await processUserNotes(user, async ({ title, text, page, editor }) => {
        if (text.includes('---')) {
            logEvent(user.id, 'worker:note:skipped', { message: `Note "${title}" already processed.` });
            return false;
        }

        const prompt = text.replace(user.settings.trigger || '<', '').trim();
        const claudeResponse = await askClaude(user, {
          prompt,
          systemPrompt: 'Если вопрос на русском, но латиницей, ответь на русском.'
        });

        const newText = `${text}\n\n---\n\n${claudeResponse}`;
        await page.evaluate((el, content) => el.value = content, editor, newText);
        
        logEvent(user.id, 'note_processed', { result: 'success', message: `Note "${title}" processed.` });
        return true;
      });
      logEvent(user.id, 'worker:user:success', { message: `Successfully processed user ${user.email}` });
    } catch (error) {
      logEvent(user.id, 'worker:user:fail', { result: 'error', message: error.message, stack: error.stack });
    }
  }
  logEvent(null, 'worker:cycle:end');
}

function start() {
  if (intervalId) return;
  logEvent(null, 'worker:start', { message: `Worker started, will run every ${workerInterval / 1000}s` });
  processAllUsers();
  intervalId = setInterval(processAllUsers, workerInterval);
}

function stop() {
  if (!intervalId) return;
  logEvent(null, 'worker:stop');
  clearInterval(intervalId);
  intervalId = null;
}

module.exports = { start, stop }; 