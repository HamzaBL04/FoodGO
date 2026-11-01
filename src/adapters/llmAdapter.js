'use strict';

/**
 * LLM adapter (Adapter pattern, SDD §7.1.2): the only place that talks to a
 * language model. Used for one advisory feature: turning the demand forecast
 * into a short prep note for restaurant staff.
 *
 * Disabled unless ANTHROPIC_API_KEY is set; callers must always have a
 * non-AI fallback. No customer personal data is ever sent: only dish names,
 * counts and the date.
 */
function createAnthropicAdapter({ apiKey, model, timeoutMs = 8000, fetchImpl = globalThis.fetch }) {
  return {
    name: 'anthropic',
    enabled: Boolean(apiKey),
    model,
    async complete(prompt) {
      if (!apiKey) throw new Error('LLM disabled');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
        const data = await res.json();
        const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
        if (!text) throw new Error('LLM returned no text');
        return text;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

module.exports = { createAnthropicAdapter };
