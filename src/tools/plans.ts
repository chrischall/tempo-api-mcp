import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TempoClient } from '../client.js';

export const toolDefinitions: Tool[] = [
  {
    name: 'tempo_get_plans',
    description: 'Retrieve a list of Tempo plans (resource allocations) matching the given parameters. Requires from and to dates.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date (YYYY-MM-DD) — required' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD) — required' },
        accountIds: { type: 'array', items: { type: 'string' }, description: 'Filter by user account ids' },
        assigneeTypes: { type: 'array', items: { type: 'string', enum: ['USER', 'GENERIC'] }, description: 'Filter by assignee type' },
        genericResourceIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by generic resource ids' },
        issueIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by Jira issue ids' },
        projectIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by Jira project ids' },
        planIds: { type: 'array', items: { type: 'integer' }, description: 'Filter by specific plan ids' },
        planItemTypes: { type: 'array', items: { type: 'string', enum: ['ISSUE', 'PROJECT'] }, description: 'Filter by plan item type' },
        plannedTimeBreakdown: { type: 'array', items: { type: 'string', enum: ['DAILY', 'PERIOD'] }, description: 'Time breakdown granularity' },
        updatedFrom: { type: 'string', description: 'Filter by update date' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (max 5000)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'tempo_get_plan',
    description: 'Retrieve a single Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Plan id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tempo_create_plan',
    description: 'Create a new Tempo plan (resource allocation) for a user or generic resource against an issue or project.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        assigneeId: { type: 'string', description: 'Atlassian account id (for USER) or generic resource id (for GENERIC)' },
        assigneeType: { type: 'string', enum: ['USER', 'GENERIC'], description: 'Type of assignee' },
        planItemId: { type: 'string', description: 'Id of the issue or project to plan against' },
        planItemType: { type: 'string', enum: ['ISSUE', 'PROJECT'], description: 'Type of plan item' },
        startDate: { type: 'string', description: 'Plan start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Plan end date (YYYY-MM-DD)' },
        plannedSeconds: { type: 'integer', description: 'Total seconds planned (for TOTAL_SECONDS persistence type)' },
        plannedSecondsPerDay: { type: 'integer', description: 'Seconds planned per day (for SECONDS_PER_DAY persistence type)' },
        effortPersistenceType: { type: 'string', enum: ['SECONDS_PER_DAY', 'TOTAL_SECONDS'], description: 'How effort is distributed' },
        description: { type: 'string', description: 'Plan description' },
        startTime: { type: 'string', description: 'Start time (HH:mm)', pattern: '^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])$' },
        includeNonWorkingDays: { type: 'boolean', description: 'Include non-working days in plan' },
        rule: { type: 'string', enum: ['NEVER', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY'], description: 'Recurrence rule' },
        recurrenceEndDate: { type: 'string', description: 'End date for recurrence (YYYY-MM-DD)' },
      },
      required: ['assigneeId', 'assigneeType', 'planItemId', 'planItemType', 'startDate', 'endDate'],
    },
  },
  {
    name: 'tempo_update_plan',
    description: 'Update an existing Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Plan id' },
        assigneeId: { type: 'string', description: 'Atlassian account id or generic resource id' },
        assigneeType: { type: 'string', enum: ['USER', 'GENERIC'], description: 'Type of assignee' },
        planItemId: { type: 'string', description: 'Id of the issue or project' },
        planItemType: { type: 'string', enum: ['ISSUE', 'PROJECT'], description: 'Type of plan item' },
        startDate: { type: 'string', description: 'Plan start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Plan end date (YYYY-MM-DD)' },
        plannedSeconds: { type: 'integer', description: 'Total seconds planned' },
        plannedSecondsPerDay: { type: 'integer', description: 'Seconds planned per day' },
        effortPersistenceType: { type: 'string', enum: ['SECONDS_PER_DAY', 'TOTAL_SECONDS'], description: 'How effort is distributed' },
        description: { type: 'string', description: 'Plan description' },
        startTime: { type: 'string', description: 'Start time (HH:mm)' },
        includeNonWorkingDays: { type: 'boolean', description: 'Include non-working days in plan' },
        rule: { type: 'string', enum: ['NEVER', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY'], description: 'Recurrence rule' },
        recurrenceEndDate: { type: 'string', description: 'End date for recurrence' },
      },
      required: ['id', 'assigneeId', 'assigneeType', 'planItemId', 'planItemType', 'startDate', 'endDate'],
    },
  },
  {
    name: 'tempo_delete_plan',
    description: 'Delete a Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Plan id' },
      },
      required: ['id'],
    },
  },
];

type PlanBody = {
  assigneeId: string;
  assigneeType: string;
  planItemId: string;
  planItemType: string;
  startDate: string;
  endDate: string;
  plannedSeconds?: number;
  plannedSecondsPerDay?: number;
  effortPersistenceType?: string;
  description?: string;
  startTime?: string;
  includeNonWorkingDays?: boolean;
  rule?: string;
  recurrenceEndDate?: string;
};

function buildPlanBody(args: PlanBody): Record<string, unknown> {
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

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  client: TempoClient
): Promise<CallToolResult> {
  switch (name) {
    case 'tempo_get_plans': {
      const { from, to, accountIds, assigneeTypes, genericResourceIds, issueIds, projectIds, planIds, planItemTypes, plannedTimeBreakdown, updatedFrom, offset, limit } = args as {
        from: string;
        to: string;
        accountIds?: string[];
        assigneeTypes?: string[];
        genericResourceIds?: number[];
        issueIds?: number[];
        projectIds?: number[];
        planIds?: number[];
        planItemTypes?: string[];
        plannedTimeBreakdown?: string[];
        updatedFrom?: string;
        offset?: number;
        limit?: number;
      };
      const data = await client.request('GET', '/4/plans', undefined, {
        from, to, accountIds, assigneeTypes, genericResourceIds, issueIds, projectIds, planIds, planItemTypes, plannedTimeBreakdown, updatedFrom, offset, limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_plan': {
      const { id } = args as { id: number };
      const data = await client.request('GET', `/4/plans/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_create_plan': {
      const body = buildPlanBody(args as PlanBody);
      const data = await client.request('POST', '/4/plans', body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_update_plan': {
      const { id, ...rest } = args as { id: number } & PlanBody;
      const body = buildPlanBody(rest);
      const data = await client.request('PUT', `/4/plans/${id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_delete_plan': {
      const { id } = args as { id: number };
      await client.request('DELETE', `/4/plans/${id}`);
      return { content: [{ type: 'text', text: `Plan ${id} deleted successfully` }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
