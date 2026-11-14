// LLM client (gemini | groq | xai): credentials resolution, connection check, generation, error classification.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CREDS_FILE = path.join(ROOT, 'credentials.json');
// groq and xai expose OpenAI-compatible APIs, so they share the openai SDK.
const PROVIDERS = {
  gemini: { model: 'gemini-3.8-flash' },
  groq: { model: 'openai/gpt-oss-120b', baseURL: 'https://api.groq.com/openai/v1' },
  xai: { model: 'grok-3-mini', baseURL: 'https://api.x.ai/v1' },
};
const DEFAULT_PROVIDER = 'groq';

/** env -> credentials.json -> terminal prompt (persisted to credentials.json). */
export async function resolveCredentials(ask) {
  const creds = { PROVIDER: process.env.PROVIDER, MODEL: process.env.MODEL, API_KEY: process.env.API_KEY };
  let source = 'env';
  if (!creds.API_KEY || !creds.MODEL) {
    if (fs.existsSync(CREDS_FILE)) {
      const file = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
      for (const k of Object.keys(creds)) creds[k] ||= file[k];
      source = 'credentials.json';
    }
    if (!creds.API_KEY || !creds.MODEL) {
      console.log('API_KEY / MODEL not found in env or credentials.json.');
      creds.PROVIDER ||= (await ask(`PROVIDER (${Object.keys(PROVIDERS).join('|')}) [${DEFAULT_PROVIDER}]: `)).trim() || DEFAULT_PROVIDER;
      const def = PROVIDERS[creds.PROVIDER.toLowerCase()]?.model ?? '';
      creds.API_KEY ||= (await ask(`${creds.PROVIDER} API_KEY: `)).trim();
      creds.MODEL ||= (await ask(`MODEL [${def}]: `)).trim() || def;
      // Owner-only: file holds the API key.
      fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
      fs.chmodSync(CREDS_FILE, 0o600);
      source = 'terminal (saved to credentials.json)';
    }
  }
  creds.PROVIDER = (creds.PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  if (!PROVIDERS[creds.PROVIDER]) throw new Error(`Unsupported PROVIDER "${creds.PROVIDER}" (use ${Object.keys(PROVIDERS).join(' | ')})`);
  return { ...creds, source };
}

export class LLM {
  constructor({ API_KEY, MODEL, PROVIDER }) {
    this.provider = PROVIDER;
    this.model = MODEL;
    if (PROVIDER === 'gemini') this.ai = new GoogleGenAI({ apiKey: API_KEY });
    else this.oa = new OpenAI({ apiKey: API_KEY, baseURL: PROVIDERS[PROVIDER].baseURL });
  }

  /** Lightweight non-generative check: fetch model metadata. */
  async check() {
    if (this.ai) await this.ai.models.get({ model: this.model });
    else {
      // list instead of retrieve: Groq 404s on URL-encoded ids like "openai%2Fgpt-oss-120b"
      const ids = [];
      for await (const m of this.oa.models.list()) ids.push(m.id);
      if (!ids.includes(this.model)) throw new Error(`Model "${this.model}" not available for this key`);
    }
  }

  /** contents use Gemini shape [{role:'user'|'model', parts:[{text}]}]; mapped for OpenAI-compatible APIs. */
  async #callOnce(system, contents) {
    if (this.ai) {
      const r = await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: { systemInstruction: system, temperature: 0.4, responseMimeType: 'application/json' },
      });
      return r.text ?? '';
    }
    const r = await this.oa.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        ...contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => p.text).join('') })),
      ],
    });
    return r.choices[0]?.message?.content ?? '';
  }

  /** One generation call; returns raw text. Prints estimated tokens first. */
  async generate(system, contents) {
    const chars = system.length + contents.reduce((n, c) => n + c.parts.map((p) => p.text).join('').length, 0);
    console.log(`  [llm] estimated input tokens: ~${Math.ceil(chars / 4)}`);
    const call = () => this.#callOnce(system, contents);
    // Retry transient overload (500/503) or empty replies twice; quota/auth/size errors surface immediately.
    for (let attempt = 0; ; attempt++) {
      try {
        const text = await call();
        if (text.trim() || attempt >= 2) return text;
        console.log('  [llm] empty reply, retrying ...');
      } catch (err) {
        if (attempt >= 2 || ![500, 503].includes(err?.status)) throw err;
        console.log(`  [llm] model busy (${err.status}), retrying ...`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
}

/** Map SDK errors to: 'quota' | 'too_large' | 'auth' | 'other'. */
export function classifyError(err) {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message ?? err);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) return 'quota';
  if (status === 413 || /too large|token.*(limit|exceed)|exceeds.*token|context length/i.test(msg)) return 'too_large';
  if (status === 401 || status === 403 || /API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) return 'auth';
  return 'other';
}

/** One-line error text; unwraps a JSON error body when present. */
export function shortError(err) {
  let msg = String(err?.message ?? err);
  try {
    msg = JSON.parse(msg.slice(msg.indexOf('{'))).error?.message ?? msg;
  } catch {}
  return msg.replace(/\s+/g, ' ').slice(0, 200);
}
