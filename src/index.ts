#!/usr/bin/env node
import { runMcp } from '@chrischall/mcp-utils';
import { TempoClient } from './client.js';
import { register as registerWorklogs } from './tools/worklogs.js';
import { register as registerPlans } from './tools/plans.js';
import { register as registerTeams } from './tools/teams.js';
import { register as registerAccounts } from './tools/accounts.js';
import { register as registerProjects } from './tools/projects.js';

const client = new TempoClient();

await runMcp({
  name: 'tempo-api-mcp',
  version: '2.1.6', // x-release-please-version
  deps: client,
  tools: [
    registerWorklogs,
    registerPlans,
    registerTeams,
    registerAccounts,
    registerProjects,
  ],
  banner:
    '[tempo-api-mcp] This project was developed and is maintained by AI (Claude Sonnet 4.6). Use at your own discretion.',
});
