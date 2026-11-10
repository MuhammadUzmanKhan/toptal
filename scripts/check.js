// Pre-interview smoke test: tests the primary AND every fallback provider separately.
import { complete, provider, fallbacks, modelFor, KEY_VARS } from '../src/llm.js';

console.log(`Node ${process.version} | primary=${provider} | fallback=${fallbacks.join(',') || 'none'}\n`);

let failed = 0;
for (const p of [provider, ...fallbacks]) {
  const label = `${p} (${modelFor(p)})`;
  if (!process.env[KEY_VARS[p]]) {
    console.error(`✗ ${label}: ${KEY_VARS[p]} not set`);
    failed++;
    continue;
  }
  try {
    const t0 = Date.now();
    const text = await complete({ prompt: 'Reply with exactly: pong', provider: p });
    const obj = await complete({ prompt: 'Return {"ok": true, "n": 42}', json: true, provider: p });
    console.log(`✓ ${label}: text="${text.trim()}" json=${JSON.stringify(obj)} (${Date.now() - t0}ms)`);
  } catch (err) {
    console.error(`✗ ${label}: ${err.status ?? ''} ${err.message.slice(0, 160)}`);
    failed++;
  }
}

console.log(failed ? `\n${failed} provider(s) failing.` : '\nAll good.');
process.exit(failed ? 1 : 0);
