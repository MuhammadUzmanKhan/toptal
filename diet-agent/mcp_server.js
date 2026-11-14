// MCP server (stdio) exposing the two JSON ingestion tools over ./input/meals.json.
// Started lazily by main.js as a child process; can also be run alone: `npm run mcp`.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { recentFavorites, monthlySummary } from './lib/meals.js';

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


// server.registerTool(
//   'get_user_recent_meals',
//   {
//     description: "Useers's 30 meals most recent faviourit mels (desc by date+time). Keys:",
//     inputSchema: userArg,
//   },
//   async ({ user_id }) => asText(recentFavorites(user_id))
// );
await server.connect(new StdioServerTransport());
