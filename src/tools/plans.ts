import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

function buildPlanBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    assigneeId: args.assigneeId,
    assigneeType: args.assigneeType,
    planItemId: args.planItemId,
    planItemType: args.planItemType,
    startDate: args.startDate,
    endDate: args.endDate,
  };
  if (args.plannedSeconds !== undefined) body.plannedSeconds = args.plannedSeconds;
  if (args.plannedSecondsPerDay !== undefined) body.plannedSecondsPerDay = args.plannedSecondsPerDay;
  if (args.effortPersistenceType !== undefined) body.effortPersistenceType = args.effortPersistenceType;
  if (args.description !== undefined) body.description = args.description;
  if (args.startTime !== undefined) body.startTime = args.startTime;
  if (args.includeNonWorkingDays !== undefined) body.includeNonWorkingDays = args.includeNonWorkingDays;
  if (args.rule !== undefined) body.rule = args.rule;
  if (args.recurrenceEndDate !== undefined) body.recurrenceEndDate = args.recurrenceEndDate;
  return body;
}

const planFields = {
  assigneeId: z.string().describe('Atlassian account id (for USER) or generic resource id (for GENERIC)'),
  assigneeType: z.enum(['USER', 'GENERIC']).describe('Type of assignee'),
  planItemId: z.string().describe('Id of the issue or project to plan against'),
  planItemType: z.enum(['ISSUE', 'PROJECT']).describe('Type of plan item'),
  startDate: z.string().describe('Plan start date (YYYY-MM-DD)'),
  endDate: z.string().describe('Plan end date (YYYY-MM-DD)'),
  plannedSeconds: z.number().int().optional().describe('Total seconds planned (for TOTAL_SECONDS persistence type)'),
  plannedSecondsPerDay: z.number().int().optional().describe('Seconds planned per day (for SECONDS_PER_DAY persistence type)'),
  effortPersistenceType: z.enum(['SECONDS_PER_DAY', 'TOTAL_SECONDS']).optional().describe('How effort is distributed'),
  description: z.string().optional().describe('Plan description'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])$/).optional().describe('Start time (HH:mm)'),
  includeNonWorkingDays: z.boolean().optional().describe('Include non-working days in plan'),
  rule: z.enum(['NEVER', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY']).optional().describe('Recurrence rule'),
  recurrenceEndDate: z.string().optional().describe('End date for recurrence (YYYY-MM-DD)'),
};

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool('tempo_get_plans', {
    description: 'Retrieve a list of Tempo plans (resource allocations) matching the given parameters. Requires from and to dates.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      from: z.string().describe('Start date (YYYY-MM-DD) — required'),
      to: z.string().describe('End date (YYYY-MM-DD) — required'),
      accountIds: z.array(z.string()).optional().describe('Filter by user account ids'),
      assigneeTypes: z.array(z.enum(['USER', 'GENERIC'])).optional().describe('Filter by assignee type'),
      genericResourceIds: z.array(z.number().int()).optional().describe('Filter by generic resource ids'),
      issueIds: z.array(z.number().int()).optional().describe('Filter by Jira issue ids'),
      projectIds: z.array(z.number().int()).optional().describe('Filter by Jira project ids'),
      planIds: z.array(z.number().int()).optional().describe('Filter by specific plan ids'),
      planItemTypes: z.array(z.enum(['ISSUE', 'PROJECT'])).optional().describe('Filter by plan item type'),
      plannedTimeBreakdown: z.array(z.enum(['DAILY', 'PERIOD'])).optional().describe('Time breakdown granularity'),
      updatedFrom: z.string().optional().describe('Filter by update date'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (max 5000)'),
    },
  }, async (args) => {
    const data = await client.request('GET', '/4/plans', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_plan', {
    description: 'Retrieve a single Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.number().int().describe('Plan id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/plans/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_create_plan', {
    description: 'Create a new Tempo plan (resource allocation) for a user or generic resource against an issue or project.',
    annotations: { readOnlyHint: false },
    inputSchema: planFields,
  }, async (args) => {
    const body = buildPlanBody(args);
    const data = await client.request('POST', '/4/plans', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_update_plan', {
    description: 'Update an existing Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      id: z.number().int().describe('Plan id'),
      ...planFields,
    },
  }, async ({ id, ...rest }) => {
    const body = buildPlanBody(rest);
    const data = await client.request('PUT', `/4/plans/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_delete_plan', {
    description: 'Delete a Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      id: z.number().int().describe('Plan id'),
    },
  }, async ({ id }) => {
    await client.request('DELETE', `/4/plans/${id}`);
    return { content: [{ type: 'text', text: `Plan ${id} deleted successfully` }] };
  });
}
