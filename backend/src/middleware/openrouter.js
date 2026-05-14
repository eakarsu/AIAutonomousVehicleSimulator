require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

/**
 * Safely parse JSON from an AI response that may include markdown code fences.
 */
function parseAIJson(text) {
  if (!text) return null;
  // Attempt 1: direct parse
  try { return JSON.parse(text); } catch (e) {}
  // Attempt 2: strip ```json ... ``` fences
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}
  // Attempt 3: extract outermost { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }
  return null;
}

/**
 * Call the OpenRouter AI API.
 * @param {string} prompt - User prompt
 * @param {string} [systemPrompt] - Optional system prompt
 * @param {boolean} [jsonMode] - Whether to request structured JSON output
 * @returns {Promise<{success, content, parsed, model, usage, error}>}
 */
async function callOpenRouter(
  prompt,
  systemPrompt = 'You are an AI assistant specialized in autonomous vehicle technology, simulation, and self-driving algorithms.',
  jsonMode = false
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    return {
      success: false,
      error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.',
      fallback: true
    };
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.7
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'AV Simulator'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      const content = data.choices[0].message.content;
      const parsed = jsonMode ? parseAIJson(content) : null;
      return {
        success: true,
        content,
        parsed,
        model: data.model,
        usage: data.usage
      };
    } else {
      return { success: false, error: data.error?.message || 'Unknown API error', raw: data };
    }
  } catch (e) {
    if (e.name === 'TimeoutError') {
      return { success: false, error: 'Request timeout' };
    }
    return { success: false, error: e.message };
  }
}

module.exports = { callOpenRouter, parseAIJson };
