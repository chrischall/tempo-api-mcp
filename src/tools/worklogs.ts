import { z } from 'zod';
import { buildOptionalBody, IsoDate, rawTextResult, textResult } from '@chrischall/mcp-utils';
import { previewUnlessConfirmed, schemaConfirm } from './_confirm.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

// Defence-in-depth against path traversal: Atlassian account ids and Tempo
// account keys are interpolated into request paths, so constrain them to the
// characters those identifiers actually use — no slashes or other traversal
// vectors. (Atlassian account ids look like `5b10a...:abcd-1234`.)
const AccountId = z
  .string()
  .regex(/^[A-Za-z0-9:_.-]+$/, 'Invalid account id')
  .refine((v) => !v.includes('..'), 'Invalid account id');
const AccountKey = z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid account key');
// Worklog ids are interpolated into paths too (/4/worklogs/${id}) — same
// defence-in-depth: no slashes, dots, or query/fragment characters.
const WorklogId = z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid worklog id');

const WORKLOG_OPTIONAL = ['startTime', 'description', 'billableSeconds', 'remainingEstimateSeconds'] as const;

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool('tempo_get_worklogs', {
    description: 'Retrieve a list of Tempo worklogs matching the given search parameters. Supports filtering by project, issue, date range, and more.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      projectId: z.array(z.number().int()).optional().describe('Filter by project ids'),
      issueId: z.array(z.number().int()).optional().describe('Filter by issue ids'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset (default 0)'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
      orderBy: z.enum(['ID', 'START_DATE_TIME', 'UPDATED']).optional().describe('Sort order (descending)'),
    },
  }, async ({ projectId, issueId, from, to, updatedFrom, offset, limit, orderBy }) => {
    const data = await client.request('GET', '/4/worklogs', undefined, {
      projectId, issueId, from, to, updatedFrom, offset, limit, orderBy,
    });
    return textResult(data);
  });

  server.registerTool('tempo_get_worklog', {
    description: 'Retrieve a single Tempo worklog by its id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: WorklogId.describe('Worklog id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/worklogs/${id}`);
    return textResult(data);
  });

  server.registerTool('tempo_create_worklog', {
    description: 'Create a new Tempo worklog. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it creates the worklog.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      authorAccountId: z.string().describe('Atlassian account id of the worklog author'),
      issueId: z.number().int().describe('Jira issue id to log time against'),
      startDate: IsoDate.describe('Work date (YYYY-MM-DD)'),
      timeSpentSeconds: z.number().int().describe('Time spent in seconds (e.g. 3600 = 1 hour)'),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])(:[0-5][0-9])$/).optional().describe('Start time (HH:mm:ss)'),
      description: z.string().optional().describe('Description of work done'),
      billableSeconds: z.number().int().optional().describe('Billable seconds (defaults to timeSpentSeconds)'),
      remainingEstimateSeconds: z.number().int().optional().describe('Remaining estimate in seconds'),
      confirm: schemaConfirm,
    },
  }, async ({ authorAccountId, issueId, startDate, timeSpentSeconds, confirm, ...rest }) => {
    const body: Record<string, unknown> = {
      authorAccountId,
      issueId,
      startDate,
      timeSpentSeconds,
      ...buildOptionalBody(rest, WORKLOG_OPTIONAL),
    };
    const gate = previewUnlessConfirmed(confirm, `Log ${timeSpentSeconds}s against issue ${issueId} on ${startDate}`, 'POST', '/4/worklogs', body);
    if (gate) return gate;
    const data = await client.request('POST', '/4/worklogs', body);
    return textResult(data);
  });

  server.registerTool('tempo_update_worklog', {
    description: 'Update an existing Tempo worklog by id. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the update.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      id: WorklogId.describe('Worklog id'),
      authorAccountId: z.string().describe('Atlassian account id of the worklog author'),
      startDate: IsoDate.describe('Work date (YYYY-MM-DD)'),
      timeSpentSeconds: z.number().int().describe('Time spent in seconds'),
      startTime: z.string().optional().describe('Start time (HH:mm:ss)'),
      description: z.string().optional().describe('Description of work done'),
      billableSeconds: z.number().int().optional().describe('Billable seconds'),
      remainingEstimateSeconds: z.number().int().optional().describe('Remaining estimate in seconds'),
      confirm: schemaConfirm,
    },
  }, async ({ id, authorAccountId, startDate, timeSpentSeconds, confirm, ...rest }) => {
    const body: Record<string, unknown> = {
      authorAccountId,
      startDate,
      timeSpentSeconds,
      ...buildOptionalBody(rest, WORKLOG_OPTIONAL),
    };
    const gate = previewUnlessConfirmed(confirm, `Update Tempo worklog ${id}`, 'PUT', `/4/worklogs/${id}`, body);
    if (gate) return gate;
    const data = await client.request('PUT', `/4/worklogs/${id}`, body);
    return textResult(data);
  });

  server.registerTool('tempo_delete_worklog', {
    description: 'Delete a Tempo worklog by id. bypassPeriodClosuresAndApprovals can rip a worklog out of an already-approved timesheet, so this is confirm-gated: without confirm:true it returns a dry-run preview (surfacing the bypass flag) and makes NO network call; with confirm:true it deletes.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      id: WorklogId.describe('Worklog id'),
      bypassPeriodClosuresAndApprovals: z.boolean().optional().describe('Bypass period closures/approvals (requires Tempo Admin + Override Mode) — CAN remove a worklog from an APPROVED timesheet'),
      confirm: schemaConfirm,
    },
  }, async ({ id, bypassPeriodClosuresAndApprovals, confirm }) => {
    const gate = previewUnlessConfirmed(
      confirm,
      `Delete Tempo worklog ${id}${bypassPeriodClosuresAndApprovals ? ' — BYPASSING period closures/approvals (can remove it from an APPROVED timesheet)' : ''}`,
      'DELETE',
      `/4/worklogs/${id}`,
      // bypassPeriodClosuresAndApprovals travels as a query param, not a body,
      // so surface it under willSendQuery (and omit it entirely when undefined).
      undefined,
      { bypassPeriodClosuresAndApprovals },
    );
    if (gate) return gate;
    await client.request('DELETE', `/4/worklogs/${id}`, undefined, {
      bypassPeriodClosuresAndApprovals,
    });
    return rawTextResult(`Worklog ${id} deleted successfully`);
  });

  server.registerTool('tempo_search_worklogs', {
    description: 'Search Tempo worklogs using a POST body with advanced filters (author ids, issue ids, project ids, date range). For team or Tempo-account filters use tempo_get_worklogs_by_team / tempo_get_worklogs_by_account.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      authorIds: z.array(z.string()).optional().describe('Atlassian account ids of worklog authors'),
      issueIds: z.array(z.number().int()).optional().describe('Jira issue ids'),
      projectIds: z.array(z.number().int()).optional().describe('Jira project ids'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date'),
      orderBy: z.array(z.object({
        field: z.enum(['ID', 'START_DATE_TIME', 'UPDATED']),
        order: z.enum(['ASC', 'DESC']),
      })).optional().describe('Sort criteria (default START_DATE_TIME ASC, ID ASC)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ authorIds, issueIds, projectIds, from, to, updatedFrom, orderBy, offset, limit }) => {
    const query = buildOptionalBody({ offset, limit }, ['offset', 'limit'] as const);
    const body = buildOptionalBody(
      { authorIds, issueIds, projectIds, from, to, updatedFrom, orderBy },
      ['authorIds', 'issueIds', 'projectIds', 'from', 'to', 'updatedFrom', 'orderBy'] as const
    );
    const data = await client.request('POST', '/4/worklogs/search', body, query);
    return textResult(data);
  });

  server.registerTool('tempo_get_worklogs_by_user', {
    description: 'Retrieve all Tempo worklogs for a specific user (Atlassian account id).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountId: AccountId.describe('Atlassian account id of the user'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ accountId, from, to, updatedFrom, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/user/${accountId}`, undefined, { from, to, updatedFrom, offset, limit });
    return textResult(data);
  });

  server.registerTool('tempo_get_worklogs_by_project', {
    description: 'Retrieve all Tempo worklogs for a specific Jira project.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      projectId: z.number().int().describe('Jira project id'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ projectId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/project/${projectId}`, undefined, { from, to, offset, limit });
    return textResult(data);
  });

  server.registerTool('tempo_get_worklogs_by_issue', {
    description: 'Retrieve all Tempo worklogs for a specific Jira issue.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      issueId: z.number().int().describe('Jira issue id'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ issueId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/issue/${issueId}`, undefined, { from, to, offset, limit });
    return textResult(data);
  });

  server.registerTool('tempo_get_worklogs_by_team', {
    description: 'Retrieve all Tempo worklogs for a specific Tempo team.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      teamId: z.number().int().describe('Tempo team id'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ teamId, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/team/${teamId}`, undefined, { from, to, offset, limit });
    return textResult(data);
  });

  server.registerTool('tempo_get_worklogs_by_account', {
    description: 'Retrieve all Tempo worklogs associated to a Tempo account key.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountKey: AccountKey.describe('Tempo account key (e.g. ACCOUNT-123)'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ accountKey, from, to, offset, limit }) => {
    const data = await client.request('GET', `/4/worklogs/account/${accountKey}`, undefined, { from, to, offset, limit });
    return textResult(data);
  });
}
