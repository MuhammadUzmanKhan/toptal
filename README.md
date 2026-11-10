# Toptal interview environment

## Commands
- `npm test`  - POST /users tests (node:test + supertest)
- `npm run dev` - server with auto-reload on http://localhost:3000
- `npm run check` - real LLM round trip (text + JSON). **Must print "All good." before the interview.**

## Layout
- `src/app.js` - Express app, Task 3 `POST /users`
- `src/db.js` - stub `save()` (the interview provides the real one)
- `src/llm.js` - `complete({ prompt, system, temperature, json })` for openai | anthropic | gemini | xai | groq, with retry + `LLM_FALLBACK` chain
- `src/ai.js` - sample `POST /ai/summarize` (prompt -> JSON -> validate -> 502 on bad output)
- `.env` - `LLM_PROVIDER`, `LLM_MODEL` (optional), API keys (git-ignored)

## Quick curl
curl -X POST localhost:3000/users -H 'Content-Type: application/json' -d '{"name":"Ana","age":30}' p
curl -X POST localhost:3000/ai/summarize -H 'Content-Type: application/json' -d '{"text":"..."}'

## Day-before checklist (interview: Fri 13 Nov 2026, 21:00 PKT)
- [ ] Key in `.env`, `npm run check` passes, account has credit / billing
- [ ] Back-up key from a second provider (switch with LLM_PROVIDER)
- [ ] Camera, mic, screen share tested in the browser you'll use (macOS: System Settings -> Privacy -> Screen Recording)
- [ ] Hide `.env` / close tabs showing keys before sharing screen
- [ ] Editor font size bumped for screen share; notifications off (Focus mode)
- [ ] Join 5 min early: https://topt.al/k5c6M3
