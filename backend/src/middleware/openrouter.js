const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

async function callOpenRouter(prompt, systemPrompt = 'You are an AI assistant specialized in autonomous vehicle technology, simulation, and self-driving algorithms.') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    return {
      success: false,
      error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.',
      fallback: true
    };
  }

  const data = JSON.stringify({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.7
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AV Simulator'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.choices && parsed.choices[0]) {
            resolve({
              success: true,
              content: parsed.choices[0].message.content,
              model: parsed.model,
              usage: parsed.usage
            });
          } else {
            resolve({ success: false, error: parsed.error?.message || 'Unknown API error', raw: parsed });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse API response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(data);
    req.end();
  });
}

module.exports = { callOpenRouter };
