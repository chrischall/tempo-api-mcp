import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

function buildTeamBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { name: args.name };
  if (args.summary !== undefined) body.summary = args.summary;
  if (args.leadAccountId !== undefined) body.leadAccountId = args.leadAccountId;
  if (args.programId !== undefined) body.programId = args.programId;
  return body;
}

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool('tempo_get_teams', {
    description: 'Retrieve a list of Tempo teams. Can filter by name, member account ids, or specific team ids.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      name: z.string().optional().describe('Filter by team name'),
      teamIds: z.array(z.number().int()).optional().describe('Filter by specific team ids'),
      teamMembers: z.array(z.string()).optional().describe('Filter by member Atlassian account ids'),
      includeMemberships: z.boolean().optional().describe('Include team member memberships in response'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ name: teamName, teamIds, teamMembers, includeMemberships, offset, limit }) => {
    const data = await client.request('GET', '/4/teams', undefined, {
      name: teamName, teamIds, teamMembers, includeMemberships, offset, limit,
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_team', {
    description: 'Retrieve a single Tempo team by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.number().int().describe('Team id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/teams/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_create_team', {
    description: 'Create a new Tempo team.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      name: z.string().describe('Team name'),
      summary: z.string().optional().describe('Short description of the team'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the team lead'),
      programId: z.number().int().optional().describe('Id of the program this team belongs to'),
    },
  }, async (args) => {
    const body = buildTeamBody(args);
    const data = await client.request('POST', '/4/teams', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_update_team', {
    description: 'Update an existing Tempo team by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      id: z.number().int().describe('Team id'),
      name: z.string().describe('Team name'),
      summary: z.string().optional().describe('Short description of the team'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the team lead'),
      programId: z.number().int().optional().describe('Id of the program this team belongs to'),
    },
  }, async ({ id, ...rest }) => {
    const body = buildTeamBody(rest);
    const data = await client.request('PUT', `/4/teams/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_delete_team', {
    description: 'Delete a Tempo team by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      id: z.number().int().describe('Team id'),
    },
  }, async ({ id }) => {
    await client.request('DELETE', `/4/teams/${id}`);
    return { content: [{ type: 'text', text: `Team ${id} deleted successfully` }] };
  });

  server.registerTool('tempo_get_team_memberships', {
    description: 'Retrieve team memberships, optionally filtered by account id or team id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountIds: z.array(z.string()).optional().describe('Filter by Atlassian account ids'),
      teamIds: z.array(z.number().int()).optional().describe('Filter by team ids'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ accountIds, teamIds, offset, limit }) => {
    const data = await client.request('GET', '/4/team-memberships', undefined, {
      accountIds, teamIds, offset, limit,
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_search_team_memberships', {
    description: 'Search Tempo team memberships with advanced filters via POST.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      teamIds: z.array(z.number().int()).optional().describe('Filter by team ids'),
      accountIds: z.array(z.string()).optional().describe('Filter by Atlassian account ids'),
      from: z.string().optional().describe('Membership active from date (YYYY-MM-DD)'),
      to: z.string().optional().describe('Membership active to date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ teamIds, accountIds, from, to, offset, limit }) => {
    const query: Record<string, unknown> = {};
    if (offset !== undefined) query.offset = offset;
    if (limit !== undefined) query.limit = limit;
    const body: Record<string, unknown> = {};
    if (teamIds) body.teamIds = teamIds;
    if (accountIds) body.accountIds = accountIds;
    if (from) body.from = from;
    if (to) body.to = to;
    const data = await client.request('POST', '/4/team-memberships/search', body, query);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });
}
