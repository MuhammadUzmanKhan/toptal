// MCP server (stdio) exposing the JSON ingestion tools over ./input/meals.json.
// Started lazily by main.js as a child process; can also be run alone: `npm run mcp`.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { recentFavorites, monthlySummary, lastMeals } from './lib/meals.js';

const server = new McpServer({ name: 'diet-meals', version: '1.0.0' });
const userArg = { user_id: z.number().int().describe('USER_ID to filter meals for') };
const asText = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

server.registerTool(
  'get_recent_favorites',
  {
    description:
      "User's 30 most recent favorite meals (desc by date+time). Keys: d=datetime t=type n=name kcal p=protein c=carbs f=fat src=procedence",
    inputSchema: userArg,
  },
  async ({ user_id }) => asText(recentFavorites(user_id))
);

server.registerTool(
  'get_monthly_summary',
  {
    description: "User's meals grouped by month: meal count, total calories, highest- and lowest-priced meal",
    inputSchema: userArg,
  },
  async ({ user_id }) => asText(monthlySummary(user_id))
);


server.registerTool(
  'get_last_meals',
  {
    description:
      "User's last 10 meals consumed, sorted by date and time descending. Each item is a ready-to-print line: <date_consumed> <time_consumed> <type> <procedence> <name>",
    inputSchema: userArg,
  },
  async ({ user_id }) => asText(lastMeals(user_id))
);

await server.connect(new StdioServerTransport());
