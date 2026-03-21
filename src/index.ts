#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { TempoClient } from './client.js';
import { toolDefinitions as worklogTools, handleTool as handleWorklogs } from './tools/worklogs.js';
import { toolDefinitions as planTools, handleTool as handlePlans } from './tools/plans.js';
import { toolDefinitions as teamTools, handleTool as handleTeams } from './tools/teams.js';
import { toolDefinitions as accountTools, handleTool as handleAccounts } from './tools/accounts.js';
import { toolDefinitions as projectTools, handleTool as handleProjects } from './tools/projects.js';

const client = new TempoClient();

const allTools = [
  ...worklogTools,
  ...planTools,
  ...teamTools,
  ...accountTools,
  ...projectTools,
];

const handlers: Record<string, (name: string, args: Record<string, unknown>) => Promise<CallToolResult>> = {};

for (const tool of worklogTools) handlers[tool.name] = (n, a) => handleWorklogs(n, a, client);
for (const tool of planTools) handlers[tool.name] = (n, a) => handlePlans(n, a, client);
for (const tool of teamTools) handlers[tool.name] = (n, a) => handleTeams(n, a, client);
for (const tool of accountTools) handlers[tool.name] = (n, a) => handleAccounts(n, a, client);
for (const tool of projectTools) handlers[tool.name] = (n, a) => handleProjects(n, a, client);

const server = new Server(
  { name: 'tempo-api-mcp', version: '1.0.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const handler = handlers[name];
  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    return await handler(name, args as Record<string, unknown>);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

console.error('[tempo-api-mcp] This project was developed and is maintained by AI (Claude Sonnet 4.6). Use at your own discretion.');

const transport = new StdioServerTransport();
await server.connect(transport);
