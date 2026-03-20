import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TempoClient } from '../client.js';

export const toolDefinitions: Tool[] = [
  {
    name: 'tempo_get_projects',
    description: 'Retrieve a paginated list of all Tempo Financial Manager projects.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_project',
    description: 'Retrieve a single Tempo Financial Manager project by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tempo_get_timesheet_approval_status',
    description: 'Retrieve the current timesheet approval status for a user in the given period.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Atlassian account id of the user' },
        from: { type: 'string', description: 'Period start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'Period end date (YYYY-MM-DD)' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'tempo_get_timesheet_approvals_waiting',
    description: 'Retrieve all timesheets that are currently waiting for approval.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_search_timesheet_approval_logs',
    description: 'Search timesheet approval audit logs.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        accountIds: { type: 'array', items: { type: 'string' }, description: 'Filter by Atlassian account ids' },
        reviewerIds: { type: 'array', items: { type: 'string' }, description: 'Filter by reviewer account ids' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_periods',
    description: 'Retrieve Tempo period definitions (used for timesheet approval cycles).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_user_schedule',
    description: 'Retrieve the work schedule for a user, including planned working hours per day.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Atlassian account id of the user' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['accountId', 'from', 'to'],
    },
  },
  {
    name: 'tempo_get_global_configuration',
    description: 'Retrieve the global Tempo configuration settings.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'tempo_get_work_attributes',
    description: 'Retrieve all Tempo work attributes (custom fields on worklogs).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_roles',
    description: 'Retrieve all Tempo roles.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results' },
      },
      required: [],
    },
  },
];

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  client: TempoClient
): Promise<CallToolResult> {
  switch (name) {
    case 'tempo_get_projects': {
      const { offset, limit } = args as { offset?: number; limit?: number };
      const data = await client.request('GET', '/4/projects', undefined, { offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_project': {
      const { id } = args as { id: string };
      const data = await client.request('GET', `/4/projects/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_timesheet_approval_status': {
      const { accountId, from, to } = args as { accountId: string; from?: string; to?: string };
      const data = await client.request('GET', `/4/timesheet-approvals/user/${accountId}`, undefined, { from, to });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_timesheet_approvals_waiting': {
      const { offset, limit } = args as { offset?: number; limit?: number };
      const data = await client.request('GET', '/4/timesheet-approvals/waiting', undefined, { offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_search_timesheet_approval_logs': {
      const { accountIds, reviewerIds, from, to, offset, limit } = args as {
        accountIds?: string[];
        reviewerIds?: string[];
        from?: string;
        to?: string;
        offset?: number;
        limit?: number;
      };
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
    }

    case 'tempo_get_periods': {
      const { from, to } = args as { from?: string; to?: string };
      const data = await client.request('GET', '/4/periods', undefined, { from, to });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_user_schedule': {
      const { accountId, from, to } = args as { accountId: string; from: string; to: string };
      const data = await client.request('GET', `/4/user-schedule`, undefined, { accountId, from, to });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_global_configuration': {
      const data = await client.request('GET', '/4/globalconfiguration');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_work_attributes': {
      const { offset, limit } = args as { offset?: number; limit?: number };
      const data = await client.request('GET', '/4/work-attributes', undefined, { offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_roles': {
      const { offset, limit } = args as { offset?: number; limit?: number };
      const data = await client.request('GET', '/4/roles', undefined, { offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
