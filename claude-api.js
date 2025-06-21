const axios = require('axios');

/**
 * Sends a message to the Claude API and returns the response.
 * @param {string} userMessage The message from the user to send to Claude.
 * @param {string} apiKey The Claude API key.
 * @param {string} model The Claude model to use.
 * @param {object} options Optional options for the Claude API request.
 * @returns {Promise<string>} The content of Claude's response.
 * @throws {Error} If the API call fails or returns an error.
 */
async function getClaudeResponse(userMessage, apiKey, model, options = {}) {
    try {
        const body = {
            model: model,
            max_tokens: 1500,
            messages: [{ role: 'user', content: userMessage }]
        };
        if (options.systemPrompt) {
            body.system = options.systemPrompt;
        }
        const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });

        if (response.data && response.data.content && response.data.content.length > 0) {
            return response.data.content[0].text;
        } else {
            throw new Error('Invalid response structure from Claude API');
        }
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Claude API Error Response:', error.response.data);
            throw new Error(`Claude API Error: ${error.response.status} ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Claude API No Response:', error.request);
            throw new Error('No response received from Claude API.');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Claude API Request Setup Error:', error.message);
            throw new Error(`Error setting up Claude API request: ${error.message}`);
        }
    }
}

module.exports = { getClaudeResponse }; 