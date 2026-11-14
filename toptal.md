# Task: Build a Toy AI Agent

Create a standalone test project implementing a toy AI agent based on the specifications below.
Proceed straightforwardly with implementation after resolving the user choices.
Do not engage in deep architectural planning, multi-phase scoping, full testing scripts, or any other overcomplications.

## Project Goal
You are provided with a list of inputs from a daily diet platform.
The data is available in JSON format from this short link: https://topt.al/r6cvQM, resolve the short URL redirect to get the target destination URL before processing.
Your goal is to create a command line AI agent to inform the users about their diets using the input data and implementing a series of requirements.

## 1. Initial User Discovery (Mandatory Step 1)
Before generating any application files or project layouts, you must explicitly ask the user for two foundational configuration items via your conversational interface:
1. **Programming Language Selection**: Ask what the output programming language should be. Default to **Python** if the user hits enter or does not specify.
2. **Remote LLM Provider Selection**: Ask which remote LLM provider to use (e.g., Gemini, OpenAI, Anthropic, Groq, OpenRouter, or Ollama) so you know exactly which network dependencies, standard SDKs, and invocation libraries to install.

## 2. Core Architecture (The Agent loop)
Create a command-line AI agent that runs in an infinite loop and uses the remote LLM, with API credentials loaded from a credentials.json file.
The agent should follow these core principles:
    * Receive user input as part of the interaction flow
    * Use the LLM to determine what actions should be taken
    * Execute the LLM’s instructions by invoking MCP tools or returning a final response to the user
Repeat the reasoning-and-action cycle as needed before producing the final response

System diagram:
```text
┌──────────────────────────────────────────────────┐
│ Startup                                          │
│ - load PROVIDER/MODEL/API_KEY from env           │
│ - fallback to credentials.json                   │
│ - fallback to terminal prompt and persist file   │
│ - validate LLM connection                        │
│ - ensure input/meals.json exists                 │
│ - load or prompt USER_ID and persist USER_ID.md  │
└───────────────────────┬──────────────────────────┘
                        v
┌──────────────────────────────────────────────────┐
│ Terminal CLI / Main loop                         │
│ - prints USER_ID, provider, and model            │
│ - accepts option 1, 2, 3, or q                   │
└───────────────────────┬──────────────────────────┘
                        │
        ┌───────────────┼────────────────┬───────────────┐
        │               │                │               │
        v               v                v               v
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Option 1     │ │ Option 2     │ │ Option 3     │ │ q            │
│ Meal history │ │ LLM-backed   │ │ Change       │ │ Quit         │
│ snapshot     │ │ recommend    │ │ USER_ID      │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       v                v                v                v
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Local JSON   │ │ Validate LLM │ │ Persist      │ │ Exit process │
│ filtering    │ │ connection   │ │ USER_ID.md   │ │              │
│ input/meals  │ └──────┬───────┘ └──────┬───────┘ └──────────────┘
└──────┬───────┘        │                │
       │                v                v
       │         ┌──────────────┐ ┌──────────────┐
       │         │ Start MCP    │ │ Return to    │
       │         │ sessions     │ │ main loop    │
       │         │ lazily       │ └──────────────┘
       │         └──────┬───────┘
       │                │
       │                v
       │         ┌──────────────┐
       │         │ Remote LLM   │
       │         │ JSON tool    │
       │         │ loop         │
       │         └──────┬───────┘
       │                │
       │        ┌───────┴────────────────┐
       │        │                        │
       │        v                        v
       │ ┌──────────────┐         ┌──────────────┐
       │ │ Final answer │         │ MCP JSON     │
       │ │ from LLM     │         │ tools        │
       │ └──────┬───────┘         │ - favorites  │
       │        │                 │ - summaries  │
       │        │                 └──────┬───────┘
       │        │                        │ compact tool output
       │        │                        v
       │        │                 ┌──────────────┐
       │        │                 │ Remote LLM   │
       │        │                 │ final answer │
       │        │                 └──────┬───────┘
       │        │                        │
       └────────┴────────────┬───────────┘
                             v
                      ┌──────────────┐
                      │ Terminal     │
                      │ response     │
                      └──────────────┘
```

## 3. Initialization
When the agent starts, it will perform several basic initialization tasks:
* Resolve credentials from environment variables, `credentials.json`, or a terminal prompt
* Check the LLM connection. If the startup check fails from quota/rate-limit, continue and show the menu; otherwise report the issue and keep option 1 available
* Verify that the input JSON file is present in the `./input` directory; if not, download it
* Prompt the user for the USER_ID value and store it in a local `USER_ID.md` file to be used as context for subsequent interactions

## 4. JSON Ingestion MCPs
Create an MCP tool that accesses the JSON file in the `./input` directory and filters all meals for a specified USER_ID, and pick only the favorites (by str field favorite == "true") and keep only the 30 more recent meals by str field date_consumed "yyyy-mm-dd" plus time_consumed "hh:mm". 
Create an MCP tool that accesses the JSON file in the `./input` directory and filters all meals for a specified USER_ID, and groups it by month using the str field date_consumed "yyyy-mm-dd", and it calculates total calories and identifies both the highest and lowest-priced meals for each month. 
These tools will be available for the agent to invoke as needed.
Use this schema structure to parse and validate input data:
```text
[
   {
    "id": int,
    "user_id": int,
    "age": int,
    "user_weight": float,
    "name": string,
    "price": float,
    "weight": int,
    "calories": int,
    "fat": float,
    "carbs": float,
    "protein": float,
    "time_consumed": string (hh:mm),
    "date_consumed": string (yyyy-mm-dd),
    "type": string (breakfast|lunch|dinner|snack),
    "favorite": bool,
    "procedence": string (homemade|purchased)
  }
]
```

## 5. Main Application Loop & CLI Commands
The user’s dietary interactions will be limited to a predefined set of options, which the user will select by number.
The corresponding interaction text will then be sent to the LLM for processing.
The agent loop will show in every turn the current USER_ID, the LLM provider and the LLM model used and, after that, the interaction options.
Those options are:
    1. Provide a list of the meal history, sorted by date and time in descending order and show only the first 3 lines and the last 3 lines
    2. Recommend 5 meals for the upcoming days to ensure the diet is healthy and non-repetitive, based on the recent user’s favorites
    3. Change user_id
    q. Quit
Output format for option 1: <date_consumed> <time_consumed> <type> <procedence> <name>
To optimize token usage, the option 1 output will filter the history straightforward within the agent’s code, and no LLM call is involved for this option.

## 6. Network Generation Constraints (LLM Integration)
* **LLM Client**: Connect to the chosen network-based LLM provider using the target libraries for the selected provider.
* **Environment Variables**: Assume you have access to `API_KEY` and `MODEL` environment variables. 
* **File Fallback**: If `API_KEY` or `MODEL` are missing from the system environment, try to load from a local file named `credentials.json` with the same keys. 
* **CLI Fallback**: If `API_KEY` or `MODEL` are missing from the system environment and no `credentials.json` file is present, when the `main` CLI tool executes, prompt the user dynamically in the terminal to type them in before proceeding with any API calls and persist that values in a `credentials.json` file.
* **Prompt Construction and LLM invocation**:
  - Build prompts from the user query plus tool output for the current `USER_ID`, and tell the LLM to answer only from that data.
  - On startup, use a lightweight non-generative LLM check when possible. If it only fails from quota/rate-limit, continue and show the menu.
  - For real LLM-backed options, do not treat quota/rate-limit as success. Print a clean CLI error and return to the menu.
  - If the agent cannot parse or understand the LLM response, print the raw LLM response too.
  - Before each LLM call, print the estimated token count.
  - Keep tool outputs compact and handle request-too-large or token-limit errors cleanly.

## 7. Simple coding approach
As this is a test project:
- do not overcomplicate it with packaging extras for deployment
- keep de dependencies installation simple and traditional
- keep your file structure flat, with a maximum of two folder layers
- enable it to run cleanly from the base working directory, and inform about how to run