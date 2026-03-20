import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TempoClient } from '../client.js';

export const toolDefinitions: Tool[] = [
  {
    name: 'tempo_get_teams',
    description: 'Retrieve a list of Tempo teams. Can filter by name, member account ids, or specific team ids.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Filter by team name' },
        teamIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by specific team ids' },
        teamMembers: { type: 'array', items: { type: 'string' }, description: 'Filter by member Atlassian account ids' },
        includeMemberships: { type: 'boolean', description: 'Include team member memberships in response' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_team',
    description: 'Retrieve a single Tempo team by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Team id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tempo_create_team',
    description: 'Create a new Tempo team.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Team name' },
        summary: { type: 'string', description: 'Short description of the team' },
        leadAccountId: { type: 'string', description: 'Atlassian account id of the team lead' },
        programId: { type: 'integer', description: 'Id of the program this team belongs to' },
      },
      required: ['name'],
    },
  },
  {
    name: 'tempo_update_team',
    description: 'Update an existing Tempo team by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Team id' },
        name: { type: 'string', description: 'Team name' },
        summary: { type: 'string', description: 'Short description of the team' },
        leadAccountId: { type: 'string', description: 'Atlassian account id of the team lead' },
        programId: { type: 'integer', description: 'Id of the program this team belongs to' },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: 'tempo_delete_team',
    description: 'Delete a Tempo team by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Team id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tempo_get_team_memberships',
    description: 'Retrieve team memberships, optionally filtered by account id or team id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        accountIds: { type: 'array', items: { type: 'string' }, description: 'Filter by Atlassian account ids' },
        teamIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by team ids' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_search_team_memberships',
    description: 'Search Tempo team memberships with advanced filters via POST.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        teamIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by team ids' },
        accountIds: { type: 'array', items: { type: 'string' }, description: 'Filter by Atlassian account ids' },
        from: { type: 'string', description: 'Membership active from date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'Membership active to date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results' },
      },
      required: [],
    },
  },
];

type TeamBody = {
  name: string;
  summary?: string;
  leadAccountId?: string;
  programId?: number;
};

function buildTeamBody(args: TeamBody): Record<string, unknown> {
  const body: Record<string, unknown> = { name: args.name };
  if (args.summary !== undefined) body.summary = args.summary;
  if (args.leadAccountId !== undefined) body.leadAccountId = args.leadAccountId;
  if (args.programId !== undefined) body.programId = args.programId;
  return body;
}

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  client: TempoClient
): Promise<CallToolResult> {
  switch (name) {
    case 'tempo_get_teams': {
      const { name: teamName, teamIds, teamMembers, includeMemberships, offset, limit } = args as {
        name?: string;
        teamIds?: number[];
        teamMembers?: string[];
        includeMemberships?: boolean;
        offset?: number;
        limit?: number;
      };
      const data = await client.request('GET', '/4/teams', undefined, {
        name: teamName, teamIds, teamMembers, includeMemberships, offset, limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_team': {
      const { id } = args as { id: number };
      const data = await client.request('GET', `/4/teams/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_create_team': {
      const body = buildTeamBody(args as TeamBody);
      const data = await client.request('POST', '/4/teams', body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_update_team': {
      const { id, ...rest } = args as { id: number } & TeamBody;
      const body = buildTeamBody(rest);
      const data = await client.request('PUT', `/4/teams/${id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_delete_team': {
      const { id } = args as { id: number };
      await client.request('DELETE', `/4/teams/${id}`);
      return { content: [{ type: 'text', text: `Team ${id} deleted successfully` }] };
    }

    case 'tempo_get_team_memberships': {
      const { accountIds, teamIds, offset, limit } = args as {
        accountIds?: string[];
        teamIds?: number[];
        offset?: number;
        limit?: number;
      };
      const data = await client.request('GET', '/4/team-memberships', undefined, {
        accountIds, teamIds, offset, limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_search_team_memberships': {
      const { teamIds, accountIds, from, to, offset, limit } = args as {
        teamIds?: number[];
        accountIds?: string[];
        from?: string;
        to?: string;
        offset?: number;
        limit?: number;
      };
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
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
