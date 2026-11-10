// One function, any provider, with automatic fallback.
//   LLM_PROVIDER = primary  (openai | anthropic | gemini | xai | groq)
//   LLM_MODEL    = primary model override (optional)
//   LLM_FALLBACK = comma list of backup providers, tried in order (e.g. "groq")
//   <PROVIDER>_MODEL (e.g. GROQ_MODEL) = model override for a backup provider
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5-5',
  gemini: 'gemini-flash-lite-latest',
  xai: 'grok-3-mini',
  groq: 'openai/gpt-oss-120b',
};

// OpenAI-compatible providers: same SDK, different base URL + key
const OPENAI_COMPATIBLE = {
  openai: { key: 'OPENAI_API_KEY' },
  xai: { key: 'XAI_API_KEY', baseURL: 'https://api.x.ai/v1' },
  groq: { key: 'GROQ_API_KEY', baseURL: 'https://api.groq.com/openai/v1' },
};

export const KEY_VARS = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
};

export const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
export const model = modelFor(provider, true);
export const fallbacks = (process.env.LLM_FALLBACK || '')
  .split(',')
  .map((p) => p.trim().toLowerCase())
  .filter((p) => p && p !== provider);

export function modelFor(p, isPrimary = p === provider) {
  return (isPrimary && process.env.LLM_MODEL) || process.env[`${p.toUpperCase()}_MODEL`] || DEFAULT_MODELS[p];
}

/**
 * @param {object} opts
 * @param {string} opts.prompt        user message
 * @param {string} [opts.system]      system prompt
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.json]       ask for raw JSON and parse it
 * @param {number} [opts.maxTokens]
 * @param {string} [opts.provider]    force one provider (no fallback)
 */
export async function complete(opts) {
  const chain = opts.provider ? [opts.provider] : [provider, ...fallbacks];
  let lastErr;
  for (const p of chain) {
    try {
      return await withRetry(() => callOnce(p, modelFor(p), opts));
    } catch (err) {
      lastErr = err;
      if (p !== chain.at(-1)) console.warn(`[llm] ${p} failed (${err.status ?? err.message}), falling back`);
    }
  }
  throw lastErr;
}

// Retries transient failures (overloaded / rate limited) with backoff.
// Quota errors (no credits) and auth errors are not retried.
async function withRetry(fn, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status ?? err.code;
      const quota = status === 429 && /quota|credit/i.test(err.message ?? '');
      if (attempt >= retries || quota || ![429, 500, 502, 503, 504].includes(status)) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

async function callOnce(p, model, { prompt, system, temperature = 0.2, json = false, maxTokens = 1024 }) {
  if (!process.env[KEY_VARS[p]]) throw new Error(`${KEY_VARS[p]} not set`);
  const sys = json
    ? `${system ?? ''}\nRespond with ONLY valid raw JSON. No markdown, no code fences, no extra text.`.trim()
    : system;

  let text;
  if (OPENAI_COMPATIBLE[p]) {
    const { key, baseURL } = OPENAI_COMPATIBLE[p];
    const client = new OpenAI({ apiKey: process.env[key], ...(baseURL && { baseURL }) });
    const r = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      ...(json && { response_format: { type: 'json_object' } }),
      messages: [...(sys ? [{ role: 'system', content: sys }] : []), { role: 'user', content: prompt }],
    });
    text = r.choices[0].message.content;
  } else if (p === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(sys && { system: sys }),
      messages: [{ role: 'user', content: prompt }],
    });
    text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  } else if (p === 'gemini') {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const r = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(sys && { systemInstruction: sys }),
        ...(json && { responseMimeType: 'application/json' }),
      },
    });
    text = r.text;
  } else {
    throw new Error(`Unknown provider "${p}"`);
  }

  return json ? parseJson(text) : text;
}

// Tolerates stray ```json fences some models still add.
export function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}
