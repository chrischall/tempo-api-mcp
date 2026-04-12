#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TempoClient } from './client.js';
import { register as registerWorklogs } from './tools/worklogs.js';
import { register as registerPlans } from './tools/plans.js';
import { register as registerTeams } from './tools/teams.js';
import { register as registerAccounts } from './tools/accounts.js';
import { register as registerProjects } from './tools/projects.js';

const client = new TempoClient();

const server = new McpServer(
  { name: 'tempo-api-mcp', version: '2.0.2' },
);

registerWorklogs(server, client);
registerPlans(server, client);
registerTeams(server, client);
registerAccounts(server, client);
registerProjects(server, client);

console.error('[tempo-api-mcp] This project was developed and is maintained by AI (Claude Sonnet 4.6). Use at your own discretion.');

const transport = new StdioServerTransport();
await server.connect(transport);
