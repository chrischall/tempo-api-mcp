import { z } from 'zod';
import { IsoDate, buildOptionalBody, minifiedResult, rawTextResult } from '@chrischall/mcp-utils';
import { viewArg, viewResponse } from '../view.js';
import { previewUnlessConfirmed, schemaConfirm } from './_confirm.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

const PLAN_REQUIRED = ['assigneeId', 'assigneeType', 'planItemId', 'planItemType', 'startDate', 'endDate'] as const;
const PLAN_OPTIONAL = [
  'plannedSeconds',
  'plannedSecondsPerDay',
  'effortPersistenceType',
  'description',
  'startTime',
  'includeNonWorkingDays',
  'rule',
  'recurrenceEndDate',
] as const;

function buildPlanBody(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ...buildOptionalBody(args, PLAN_REQUIRED),
    ...buildOptionalBody(args, PLAN_OPTIONAL),
  };
}

const planFields = {
  assigneeId: z.string().describe('Atlassian account id (for USER) or generic resource id (for GENERIC)'),
  assigneeType: z.enum(['USER', 'GENERIC']).describe('Type of assignee'),
  planItemId: z.string().describe('Id of the issue or project to plan against'),
  planItemType: z.enum(['ISSUE', 'PROJECT']).describe('Type of plan item'),
  startDate: IsoDate.describe('Plan start date (YYYY-MM-DD)'),
  endDate: IsoDate.describe('Plan end date (YYYY-MM-DD)'),
  plannedSeconds: z.number().int().optional().describe('Total seconds planned (for TOTAL_SECONDS persistence type)'),
  plannedSecondsPerDay: z.number().int().optional().describe('Seconds planned per day (for SECONDS_PER_DAY persistence type)'),
  effortPersistenceType: z.enum(['SECONDS_PER_DAY', 'TOTAL_SECONDS']).optional().describe('How effort is distributed'),
  description: z.string().optional().describe('Plan description'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])$/).optional().describe('Start time (HH:mm)'),
  includeNonWorkingDays: z.boolean().optional().describe('Include non-working days in plan'),
  rule: z.enum(['NEVER', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY']).optional().describe('Recurrence rule'),
  recurrenceEndDate: IsoDate.optional().describe('End date for recurrence (YYYY-MM-DD)'),
};

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool(
    'tempo_get_plans', {
    description: 'Retrieve a list of Tempo plans (resource allocations) matching the given parameters. Requires from and to dates.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      view: viewArg(),
      from: IsoDate.describe('Start date (YYYY-MM-DD) — required'),
      to: IsoDate.describe('End date (YYYY-MM-DD) — required'),
      accountIds: z.array(z.string()).optional().describe('Filter by user account ids'),
      assigneeTypes: z.array(z.enum(['USER', 'GENERIC'])).optional().describe('Filter by assignee type'),
      genericResourceIds: z.array(z.number().int()).optional().describe('Filter by generic resource ids'),
      issueIds: z.array(z.number().int()).optional().describe('Filter by Jira issue ids'),
      projectIds: z.array(z.number().int()).optional().describe('Filter by Jira project ids'),
      planIds: z.array(z.number().int()).optional().describe('Filter by specific plan ids'),
      planItemIds: z.array(z.number().int()).optional().describe('Filter by plan item ids (issue or project ids)'),
      planItemTypes: z.array(z.enum(['ISSUE', 'PROJECT'])).optional().describe('Filter by plan item type'),
      plannedTimeBreakdown: z.array(z.enum(['DAILY', 'PERIOD'])).optional().describe('Time breakdown granularity'),
      updatedFrom: IsoDate.optional().describe('Filter by update date'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (max 5000)'),
    },
  }, async (args) => {
    const data = await client.request('GET', '/4/plans', undefined, args);
    return viewResponse(args.view, data);
  });

  server.registerTool(
    'tempo_get_plan', {
    description: 'Retrieve a single Tempo plan (resource allocation) by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      view: viewArg(),
      id: z.number().int().describe('Plan id'),
    },
  }, async ({ id, view }) => {
    const data = await client.request('GET', `/4/plans/${id}`);
    return viewResponse(view, data);
  });

  server.registerTool('tempo_create_plan', {
    description: 'Create a new Tempo plan (resource allocation) for a user or generic resource against an issue or project. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it creates the plan.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: { ...planFields, confirm: schemaConfirm },
  }, async (args) => {
    const body = buildPlanBody(args);
    const gate = previewUnlessConfirmed(args.confirm as boolean | undefined, 'Create a Tempo plan (resource allocation)', 'POST', '/4/plans', body);
    if (gate) return gate;
    const data = await client.request('POST', '/4/plans', body);
    return minifiedResult(data);
  });

  server.registerTool('tempo_update_plan', {
    description: 'Update an existing Tempo plan (resource allocation) by id. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the update.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      id: z.number().int().describe('Plan id'),
      ...planFields,
      confirm: schemaConfirm,
    },
  }, async ({ id, confirm, ...rest }) => {
    const body = buildPlanBody(rest);
    const gate = previewUnlessConfirmed(confirm, `Update Tempo plan ${id}`, 'PUT', `/4/plans/${id}`, body);
    if (gate) return gate;
    const data = await client.request('PUT', `/4/plans/${id}`, body);
    return minifiedResult(data);
  });

  server.registerTool('tempo_delete_plan', {
    description: 'Delete a Tempo plan (resource allocation) by id. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it deletes.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      id: z.number().int().describe('Plan id'),
      confirm: schemaConfirm,
    },
  }, async ({ id, confirm }) => {
    const gate = previewUnlessConfirmed(confirm, `Delete Tempo plan ${id}`, 'DELETE', `/4/plans/${id}`);
    if (gate) return gate;
    await client.request('DELETE', `/4/plans/${id}`);
    return rawTextResult(`Plan ${id} deleted successfully`);
  });
}
