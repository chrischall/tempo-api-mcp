import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool('tempo_get_worklogs', {
    description: 'Retrieve a list of Tempo worklogs matching the given search parameters. Supports filtering by project, issue, date range, and more.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      projectId: z.array(z.number().int()).optional().describe('Filter by project ids'),
      issueId: z.array(z.number().int()).optional().describe('Filter by issue ids'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset (default 0)'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
      orderBy: z.enum(['ID', 'START_DATE_TIME', 'UPDATED']).optional().describe('Sort order (descending)'),
    },
  }, async ({ projectId, issueId, from, to, updatedFrom, offset, limit, orderBy }) => {
    const data = await client.request('GET', '/4/worklogs', undefined, {
      projectId, issueId, from, to, updatedFrom, offset, limit, orderBy,
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_worklog', {
    description: 'Retrieve a single Tempo worklog by its id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.string().describe('Worklog id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/worklogs/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_create_worklog', {
    description: 'Create a new Tempo worklog.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      authorAccountId: z.string().describe('Atlassian account id of the worklog author'),
      issueId: z.number().int().describe('Jira issue id to log time against'),
      startDate: z.string().describe('Work date (YYYY-MM-DD)'),
      timeSpentSeconds: z.number().int().describe('Time spent in seconds (e.g. 3600 = 1 hour)'),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])(:[0-5][0-9])$/).optional().describe('Start time (HH:mm:ss)'),
      description: z.string().optional().describe('Description of work done'),
      billableSeconds: z.number().int().optional().describe('Billable seconds (defaults to timeSpentSeconds)'),
      remainingEstimateSeconds: z.number().int().optional().describe('Remaining estimate in seconds'),
    },
  }, async ({ authorAccountId, issueId, startDate, timeSpentSeconds, startTime, description, billableSeconds, remainingEstimateSeconds }) => {
    const body: Record<string, unknown> = { authorAccountId, issueId, startDate, timeSpentSeconds };
    if (startTime !== undefined) body.startTime = startTime;
    if (description !== undefined) body.description = description;
    if (billableSeconds !== undefined) body.billableSeconds = billableSeconds;
    if (remainingEstimateSeconds !== undefined) body.remainingEstimateSeconds = remainingEstimateSeconds;
    const data = await client.request('POST', '/4/worklogs', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_update_worklog', {
    description: 'Update an existing Tempo worklog by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      id: z.string().describe('Worklog id'),
      authorAccountId: z.string().describe('Atlassian account id of the worklog author'),
      startDate: z.string().describe('Work date (YYYY-MM-DD)'),
      timeSpentSeconds: z.number().int().describe('Time spent in seconds'),
      startTime: z.string().optional().describe('Start time (HH:mm:ss)'),
      description: z.string().optional().describe('Description of work done'),
      billableSeconds: z.number().int().optional().describe('Billable seconds'),
      remainingEstimateSeconds: z.number().int().optional().describe('Remaining estimate in seconds'),
    },
  }, async ({ id, authorAccountId, startDate, timeSpentSeconds, startTime, description, billableSeconds, remainingEstimateSeconds }) => {
    const body: Record<string, unknown> = { authorAccountId, startDate, timeSpentSeconds };
    if (startTime !== undefined) body.startTime = startTime;
    if (description !== undefined) body.description = description;
    if (billableSeconds !== undefined) body.billableSeconds = billableSeconds;
    if (remainingEstimateSeconds !== undefined) body.remainingEstimateSeconds = remainingEstimateSeconds;
    const data = await client.request('PUT', `/4/worklogs/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_delete_worklog', {
    description: 'Delete a Tempo worklog by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      id: z.string().describe('Worklog id'),
      bypassPeriodClosuresAndApprovals: z.boolean().optional().describe('Bypass period closures/approvals (requires Tempo Admin + Override Mode)'),
    },
  }, async ({ id, bypassPeriodClosuresAndApprovals }) => {
    await client.request('DELETE', `/4/worklogs/${id}`, undefined, {
      bypassPeriodClosuresAndApprovals,
    });
    return { content: [{ type: 'text', text: `Worklog ${id} deleted successfully` }] };
  });

  server.registerTool('tempo_search_worklogs', {
    description: 'Search Tempo worklogs using a POST body with advanced filters (author ids, issue ids, project ids, date range).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      authorIds: z.array(z.string()).optional().describe('Atlassian account ids of worklog authors'),
      issueIds: z.array(z.number().int()).optional().describe('Jira issue ids'),
      projectIds: z.array(z.number().int()).optional().describe('Jira project ids'),
      teamIds: z.array(z.number().int()).optional().describe('Tempo team ids'),
      accountIds: z.array(z.string()).optional().describe('Tempo account keys'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ authorIds, issueIds, projectIds, teamIds, accountIds, from, to, updatedFrom, offset, limit }) => {
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
  });

  server.registerTool('tempo_get_worklogs_by_user', {
    description: 'Retrieve all Tempo worklogs for a specific user (Atlassian account id).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountId: z.string().describe('Atlassian account id of the user'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ accountId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/user/${accountId}`, undefined, { from, to, offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_worklogs_by_project', {
    description: 'Retrieve all Tempo worklogs for a specific Jira project.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      projectId: z.number().int().describe('Jira project id'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ projectId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/project/${projectId}`, undefined, { from, to, offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_worklogs_by_issue', {
    description: 'Retrieve all Tempo worklogs for a specific Jira issue.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      issueId: z.number().int().describe('Jira issue id'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ issueId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/issue/${issueId}`, undefined, { from, to, offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_worklogs_by_team', {
    description: 'Retrieve all Tempo worklogs for a specific Tempo team.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      teamId: z.number().int().describe('Tempo team id'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ teamId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/team/${teamId}`, undefined, { from, to, offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_worklogs_by_account', {
    description: 'Retrieve all Tempo worklogs associated to a Tempo account key.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountKey: z.string().describe('Tempo account key (e.g. ACCOUNT-123)'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ accountKey, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/account/${accountKey}`, undefined, { from, to, offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });
}
