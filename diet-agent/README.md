# Diet Agent (toy CLI AI agent)

Node.js command-line agent that answers diet questions from a meal-history JSON.
It uses a remote LLM (Groq by default; Gemini and xAI also supported) and an MCP server
that exposes two JSON tools.

## Run

```bash
cd diet-agent
npm install
npm start            # = node main.js
```

Credentials are read in this order:
1. Env vars `PROVIDER` (`groq` | `gemini` | `xai`), `MODEL`, `API_KEY`
2. `credentials.json`, same keys:
   ```json
   { "PROVIDER": "groq", "MODEL": "openai/gpt-oss-120b", "API_KEY": "..." }
   ```
3. A terminal prompt. Whatever you type is saved to `credentials.json`.

Example with env vars: `PROVIDER=groq MODEL=openai/gpt-oss-120b API_KEY=gsk_... npm start`

On first run, `input/meals.json` is downloaded from `https://topt.al/r6cvQM`. The short link
is resolved first, and the file is about 2 MB. You are then asked for a `USER_ID`, which is
saved to `USER_ID.md`.

## Menu
| Option | What it does | LLM? |
|---|---|---|
| 1 | Meal history, newest first: the first 3 and last 3 lines, as `date time type procedence name` | no |
| 2 | Recommends 5 healthy, non-repetitive meals based on recent favorites | yes (agent loop + MCP) |
| 3 | Changes `USER_ID` (saved to `USER_ID.md`) | no |
| q | Quits | no |

## Architecture

```text
main.js   startup -> menu loop
  ├─ startup: credentials (env -> credentials.json -> prompt), LLM check (list/get model, non-generative;
  │           quota -> continue, other errors -> option 1 still works), ensure input/meals.json, USER_ID.md
  ├─ option 1: lib/meals.js historyLines()            (local filtering, no LLM)
  └─ option 2: validate LLM -> start MCP lazily (stdio child: mcp_server.js)
               -> JSON tool loop (max 5 steps):
                    LLM replies {"tool": ..., "args": {...}}  -> MCP callTool -> compact TOOL_RESULT -> LLM
                    LLM replies {"final": "..."}              -> print the answer
mcp_server.js   MCP server with two tools
  - get_recent_favorites(user_id): favorite == "true", the 30 most recent by date+time
  - get_monthly_summary(user_id):  per month: meal count, total kcal, highest- and lowest-priced meal
lib/meals.js    download, zod schema validation (numeric strings coerced), filters
lib/llm.js      provider client (Gemini SDK, or OpenAI SDK for Groq/xAI), token estimate, retries, error classes
```

Behaviour notes:
- The estimated token count (chars/4) is printed before every LLM call.
- Tool calls are always scoped to the current `USER_ID`. The agent will not accept an answer
  until the LLM has read the data through a tool.
- Quota or rate-limit errors, requests that are too large, and auth errors print a clean
  message and return you to the menu.
- If the LLM reply can't be parsed, the raw reply is printed.
- Tool output is compact: short keys, capped at 8000 characters.

Run the MCP server on its own with `npm run mcp` (stdio).
