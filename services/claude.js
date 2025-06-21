const axios = require('axios');

async function askClaude({ prompt, apiKey, model = 'claude-sonnet-4-20250514', systemPrompt }) {
  try {
    const body = {
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    };
    if (systemPrompt) body.system = systemPrompt;
    const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    if (res.data && res.data.content && res.data.content.length > 0) {
      return res.data.content[0].text;
    }
    throw new Error('Claude: empty response');
  } catch (e) {
    return `❌ Claude API error: ${e.response?.data?.error?.message || e.message}`;
  }
}

module.exports = { askClaude }; 