const axios = require('axios');
const { logEvent } = require('./logger');

async function askClaude(user, { prompt, model = 'claude-sonnet-4-20250514', systemPrompt }) {
  const { id: userId, settings } = user;
  const { claudeApiKey } = settings;

  const body = {
    model,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  };
  if (systemPrompt) body.system = systemPrompt;

  logEvent(userId, 'claude:request', { message: `Sending request to Claude model ${model}. Prompt length: ${prompt.length}.` });

  try {
    const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    if (res.data && res.data.content && res.data.content.length > 0) {
      const responseText = res.data.content[0].text;
      logEvent(userId, 'claude:success', { message: `Received response from Claude. Length: ${responseText.length}.` });
      return responseText;
    }

    logEvent(userId, 'claude:error', { result: 'error', message: 'Claude: empty response' });
    throw new Error('Claude: empty response');
  } catch (e) {
    const errorMessage = e.response?.data?.error?.message || e.message;
    logEvent(userId, 'claude:error', { result: 'error', message: errorMessage, stack: e.stack });
    // Не выбрасываем ошибку, а возвращаем сообщение, чтобы оно записалось в заметку
    return `❌ Claude API error: ${errorMessage}`;
  }
}

module.exports = { askClaude }; 