import { z } from 'zod';
import { buildOptionalBody, rawTextResult, textResult } from '@chrischall/mcp-utils';
import { previewUnlessConfirmed, schemaConfirm } from './_confirm.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

// MembershipSearchInput accepts exactly these three filters — the date range
// the tool used to send was ignored by the API, so results looked unfiltered.
const MEMBERSHIP_SEARCH_FILTERS = ['teamIds', 'accountIds', 'roleIds'] as const;

const TEAM_REQUIRED = ['name'] as const;
const TEAM_OPTIONAL = ['summary', 'leadAccountId', 'programId'] as const;

function buildTeamBody(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ...buildOptionalBody(args, TEAM_REQUIRED),
    ...buildOptionalBody(args, TEAM_OPTIONAL),
  };
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
    return textResult(data);
  });

  server.registerTool('tempo_get_team', {
    description: 'Retrieve a single Tempo team by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.number().int().describe('Team id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/teams/${id}`);
    return textResult(data);
  });

  server.registerTool('tempo_create_team', {
    description: 'Create a new Tempo team. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it creates the team.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      name: z.string().describe('Team name'),
      summary: z.string().optional().describe('Short description of the team'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the team lead'),
      programId: z.number().int().optional().describe('Id of the program this team belongs to'),
      confirm: schemaConfirm,
    },
  }, async (args) => {
    const body = buildTeamBody(args);
    const gate = previewUnlessConfirmed(args.confirm as boolean | undefined, `Create Tempo team "${args.name}"`, 'POST', '/4/teams', body);
    if (gate) return gate;
    const data = await client.request('POST', '/4/teams', body);
    return textResult(data);
  });

  server.registerTool('tempo_update_team', {
    description: 'Update an existing Tempo team by id. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the update.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      id: z.number().int().describe('Team id'),
      name: z.string().describe('Team name'),
      summary: z.string().optional().describe('Short description of the team'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the team lead'),
      programId: z.number().int().optional().describe('Id of the program this team belongs to'),
      confirm: schemaConfirm,
    },
  }, async ({ id, confirm, ...rest }) => {
    const body = buildTeamBody(rest);
    const gate = previewUnlessConfirmed(confirm, `Update Tempo team ${id}`, 'PUT', `/4/teams/${id}`, body);
    if (gate) return gate;
    const data = await client.request('PUT', `/4/teams/${id}`, body);
    return textResult(data);
  });

  server.registerTool('tempo_delete_team', {
    description: 'Delete a Tempo team by id. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it deletes.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      id: z.number().int().describe('Team id'),
      confirm: schemaConfirm,
    },
  }, async ({ id, confirm }) => {
    const gate = previewUnlessConfirmed(confirm, `Delete Tempo team ${id}`, 'DELETE', `/4/teams/${id}`);
    if (gate) return gate;
    await client.request('DELETE', `/4/teams/${id}`);
    return rawTextResult(`Team ${id} deleted successfully`);
  });

  server.registerTool('tempo_get_team_memberships', {
    description: 'Retrieve all memberships for a single Tempo team. To filter across teams — or by account or role — use tempo_search_team_memberships.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      teamId: z.number().int().describe('Tempo team id'),
    },
  }, async ({ teamId }) => {
    const data = await client.request('GET', `/4/team-memberships/team/${teamId}`);
    return textResult(data);
  });

  server.registerTool('tempo_search_team_memberships', {
    description: 'Search Tempo team memberships across teams, accounts, and roles via POST. Inactive memberships are included.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      teamIds: z.array(z.number().int()).optional().describe('Filter by team ids'),
      accountIds: z.array(z.string()).optional().describe('Filter by Atlassian account ids'),
      roleIds: z.array(z.number().int()).optional().describe('Filter by Tempo role ids (see tempo_get_roles)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ teamIds, accountIds, roleIds, offset, limit }) => {
    const query = buildOptionalBody({ offset, limit }, ['offset', 'limit'] as const);
    const body = buildOptionalBody(
      { teamIds, accountIds, roleIds },
      MEMBERSHIP_SEARCH_FILTERS
    );
    const data = await client.request('POST', '/4/team-memberships/search', body, query);
    return textResult(data);
  });
}
