import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool('tempo_get_projects', {
    description: 'Retrieve a paginated list of all Tempo Financial Manager projects.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ offset, limit }) => {
    const data = await client.request('GET', '/4/projects', undefined, { offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_project', {
    description: 'Retrieve a single Tempo Financial Manager project by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.string().describe('Project id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/projects/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_timesheet_approval_status', {
    description: 'Retrieve the current timesheet approval status for a user in the given period.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountId: z.string().describe('Atlassian account id of the user'),
      from: z.string().optional().describe('Period start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('Period end date (YYYY-MM-DD)'),
    },
  }, async ({ accountId, from, to }) => {
    const data = await client.request('GET', `/4/timesheet-approvals/user/${accountId}`, undefined, { from, to });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_timesheet_approvals_waiting', {
    description: 'Retrieve all timesheets that are currently waiting for approval.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ offset, limit }) => {
    const data = await client.request('GET', '/4/timesheet-approvals/waiting', undefined, { offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_search_timesheet_approval_logs', {
    description: 'Search timesheet approval audit logs.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountIds: z.array(z.string()).optional().describe('Filter by Atlassian account ids'),
      reviewerIds: z.array(z.string()).optional().describe('Filter by reviewer account ids'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ accountIds, reviewerIds, from, to, offset, limit }) => {
    const qs: Record<string, unknown> = {};
    if (offset !== undefined) qs.offset = offset;
    if (limit !== undefined) qs.limit = limit;
    const body: Record<string, unknown> = {};
    if (accountIds) body.accountIds = accountIds;
    if (reviewerIds) body.reviewerIds = reviewerIds;
    if (from) body.from = from;
    if (to) body.to = to;
    const data = await client.request('POST', '/4/timesheet-approvals/logs/search', body, qs);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_periods', {
    description: 'Retrieve Tempo period definitions (used for timesheet approval cycles).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
  }, async ({ from, to }) => {
    const data = await client.request('GET', '/4/periods', undefined, { from, to });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_user_schedule', {
    description: 'Retrieve the work schedule for a user, including planned working hours per day.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountId: z.string().describe('Atlassian account id of the user'),
      from: z.string().describe('Start date (YYYY-MM-DD)'),
      to: z.string().describe('End date (YYYY-MM-DD)'),
    },
  }, async ({ accountId, from, to }) => {
    const data = await client.request('GET', `/4/user-schedule`, undefined, { accountId, from, to });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_global_configuration', {
    description: 'Retrieve the global Tempo configuration settings.',
    annotations: { readOnlyHint: true },
  }, async () => {
    const data = await client.request('GET', '/4/globalconfiguration');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_work_attributes', {
    description: 'Retrieve all Tempo work attributes (custom fields on worklogs).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ offset, limit }) => {
    const data = await client.request('GET', '/4/work-attributes', undefined, { offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_roles', {
    description: 'Retrieve all Tempo roles.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ offset, limit }) => {
    const data = await client.request('GET', '/4/roles', undefined, { offset, limit });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });
}
