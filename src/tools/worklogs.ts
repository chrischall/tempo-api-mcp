import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TempoClient } from '../client.js';

export const toolDefinitions: Tool[] = [
  {
    name: 'tempo_get_worklogs',
    description: 'Retrieve a list of Tempo worklogs matching the given search parameters. Supports filtering by project, issue, date range, and more.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'array', items: { type: 'integer' }, description: 'Filter by project ids' },
        issueId: { type: 'array', items: { type: 'integer' }, description: 'Filter by issue ids' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        updatedFrom: { type: 'string', description: 'Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)' },
        offset: { type: 'integer', description: 'Pagination offset (default 0)' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
        orderBy: { type: 'string', enum: ['ID', 'START_DATE_TIME', 'UPDATED'], description: 'Sort order (descending)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_worklog',
    description: 'Retrieve a single Tempo worklog by its id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Worklog id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tempo_create_worklog',
    description: 'Create a new Tempo worklog.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        authorAccountId: { type: 'string', description: 'Atlassian account id of the worklog author' },
        issueId: { type: 'integer', description: 'Jira issue id to log time against' },
        startDate: { type: 'string', description: 'Work date (YYYY-MM-DD)' },
        timeSpentSeconds: { type: 'integer', description: 'Time spent in seconds (e.g. 3600 = 1 hour)' },
        startTime: { type: 'string', description: 'Start time (HH:mm:ss)', pattern: '^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])(:[0-5][0-9])$' },
        description: { type: 'string', description: 'Description of work done' },
        billableSeconds: { type: 'integer', description: 'Billable seconds (defaults to timeSpentSeconds)' },
        remainingEstimateSeconds: { type: 'integer', description: 'Remaining estimate in seconds' },
      },
      required: ['authorAccountId', 'issueId', 'startDate', 'timeSpentSeconds'],
    },
  },
  {
    name: 'tempo_update_worklog',
    description: 'Update an existing Tempo worklog by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Worklog id' },
        authorAccountId: { type: 'string', description: 'Atlassian account id of the worklog author' },
        startDate: { type: 'string', description: 'Work date (YYYY-MM-DD)' },
        timeSpentSeconds: { type: 'integer', description: 'Time spent in seconds' },
        startTime: { type: 'string', description: 'Start time (HH:mm:ss)' },
        description: { type: 'string', description: 'Description of work done' },
        billableSeconds: { type: 'integer', description: 'Billable seconds' },
        remainingEstimateSeconds: { type: 'integer', description: 'Remaining estimate in seconds' },
      },
      required: ['id', 'authorAccountId', 'startDate', 'timeSpentSeconds'],
    },
  },
  {
    name: 'tempo_delete_worklog',
    description: 'Delete a Tempo worklog by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Worklog id' },
        bypassPeriodClosuresAndApprovals: { type: 'boolean', description: 'Bypass period closures/approvals (requires Tempo Admin + Override Mode)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tempo_search_worklogs',
    description: 'Search Tempo worklogs using a POST body with advanced filters (author ids, issue ids, project ids, date range).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        authorIds: { type: 'array', items: { type: 'string' }, description: 'Atlassian account ids of worklog authors' },
        issueIds: { type: 'array', items: { type: 'integer' }, description: 'Jira issue ids' },
        projectIds: { type: 'array', items: { type: 'integer' }, description: 'Jira project ids' },
        teamIds: { type: 'array', items: { type: 'integer' }, description: 'Tempo team ids' },
        accountIds: { type: 'array', items: { type: 'string' }, description: 'Tempo account keys' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        updatedFrom: { type: 'string', description: 'Filter by update date' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_worklogs_by_user',
    description: 'Retrieve all Tempo worklogs for a specific user (Atlassian account id).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Atlassian account id of the user' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'tempo_get_worklogs_by_project',
    description: 'Retrieve all Tempo worklogs for a specific Jira project.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer', description: 'Jira project id' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'tempo_get_worklogs_by_issue',
    description: 'Retrieve all Tempo worklogs for a specific Jira issue.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        issueId: { type: 'integer', description: 'Jira issue id' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'tempo_get_worklogs_by_team',
    description: 'Retrieve all Tempo worklogs for a specific Tempo team.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'integer', description: 'Tempo team id' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'tempo_get_worklogs_by_account',
    description: 'Retrieve all Tempo worklogs associated to a Tempo account key.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        accountKey: { type: 'string', description: 'Tempo account key (e.g. ACCOUNT-123)' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: ['accountKey'],
    },
  },
];

type WorklogListQuery = {
  projectId?: number[];
  issueId?: number[];
  from?: string;
  to?: string;
  updatedFrom?: string;
  offset?: number;
  limit?: number;
  orderBy?: string;
};

type WorklogSearchBody = {
  authorIds?: string[];
  issueIds?: number[];
  projectIds?: number[];
  teamIds?: number[];
  accountIds?: string[];
  from?: string;
  to?: string;
  updatedFrom?: string;
  offset?: number;
  limit?: number;
};

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  client: TempoClient
): Promise<CallToolResult> {
  switch (name) {
    case 'tempo_get_worklogs': {
      const { projectId, issueId, from, to, updatedFrom, offset, limit, orderBy } = args as WorklogListQuery;
      const data = await client.request('GET', '/4/worklogs', undefined, {
        projectId, issueId, from, to, updatedFrom, offset, limit, orderBy,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_worklog': {
      const { id } = args as { id: string };
      const data = await client.request('GET', `/4/worklogs/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_create_worklog': {
      const { authorAccountId, issueId, startDate, timeSpentSeconds, startTime, description, billableSeconds, remainingEstimateSeconds } = args as {
        authorAccountId: string;
        issueId: number;
        startDate: string;
        timeSpentSeconds: number;
        startTime?: string;
        description?: string;
        billableSeconds?: number;
        remainingEstimateSeconds?: number;
      };
      const body: Record<string, unknown> = { authorAccountId, issueId, startDate, timeSpentSeconds };
      if (startTime !== undefined) body.startTime = startTime;
      if (description !== undefined) body.description = description;
      if (billableSeconds !== undefined) body.billableSeconds = billableSeconds;
      if (remainingEstimateSeconds !== undefined) body.remainingEstimateSeconds = remainingEstimateSeconds;
      const data = await client.request('POST', '/4/worklogs', body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_update_worklog': {
      const { id, authorAccountId, startDate, timeSpentSeconds, startTime, description, billableSeconds, remainingEstimateSeconds } = args as {
        id: string;
        authorAccountId: string;
        startDate: string;
        timeSpentSeconds: number;
        startTime?: string;
        description?: string;
        billableSeconds?: number;
        remainingEstimateSeconds?: number;
      };
      const body: Record<string, unknown> = { authorAccountId, startDate, timeSpentSeconds };
      if (startTime !== undefined) body.startTime = startTime;
      if (description !== undefined) body.description = description;
      if (billableSeconds !== undefined) body.billableSeconds = billableSeconds;
      if (remainingEstimateSeconds !== undefined) body.remainingEstimateSeconds = remainingEstimateSeconds;
      const data = await client.request('PUT', `/4/worklogs/${id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_delete_worklog': {
      const { id, bypassPeriodClosuresAndApprovals } = args as { id: string; bypassPeriodClosuresAndApprovals?: boolean };
      await client.request('DELETE', `/4/worklogs/${id}`, undefined, {
        bypassPeriodClosuresAndApprovals,
      });
      return { content: [{ type: 'text', text: `Worklog ${id} deleted successfully` }] };
    }

    case 'tempo_search_worklogs': {
      const { authorIds, issueIds, projectIds, teamIds, accountIds, from, to, updatedFrom, offset, limit } = args as WorklogSearchBody;
      const query: Record<string, unknown> = {};
      if (offset !== undefined) query.offset = offset;
      if (limit !== undefined) query.limit = limit;
      const body: Record<string, unknown> = {};
      if (authorIds) body.authorIds = authorIds;
      if (issueIds) body.issueIds = issueIds;
      if (projectIds) body.projectIds = projectIds;
      if (teamIds) body.teamIds = teamIds;
      if (accountIds) body.accountIds = accountIds;
      if (from) body.from = from;
      if (to) body.to = to;
      if (updatedFrom) body.updatedFrom = updatedFrom;
      const data = await client.request('POST', '/4/worklogs/search', body, query);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_worklogs_by_user': {
      const { accountId, from, to, offset, limit } = args as { accountId: string; from?: string; to?: string; offset?: number; limit?: number };
      const data = await client.request('GET', `/4/worklogs/user/${accountId}`, undefined, { from, to, offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_worklogs_by_project': {
      const { projectId, from, to, offset, limit } = args as { projectId: number; from?: string; to?: string; offset?: number; limit?: number };
      const data = await client.request('GET', `/4/worklogs/project/${projectId}`, undefined, { from, to, offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_worklogs_by_issue': {
      const { issueId, from, to, offset, limit } = args as { issueId: number; from?: string; to?: string; offset?: number; limit?: number };
      const data = await client.request('GET', `/4/worklogs/issue/${issueId}`, undefined, { from, to, offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_worklogs_by_team': {
      const { teamId, from, to, offset, limit } = args as { teamId: number; from?: string; to?: string; offset?: number; limit?: number };
      const data = await client.request('GET', `/4/worklogs/team/${teamId}`, undefined, { from, to, offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_worklogs_by_account': {
      const { accountKey, from, to, offset, limit } = args as { accountKey: string; from?: string; to?: string; offset?: number; limit?: number };
      const data = await client.request('GET', `/4/worklogs/account/${accountKey}`, undefined, { from, to, offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
