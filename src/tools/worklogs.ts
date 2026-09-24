import { z } from 'zod';
import { IsoDate, buildOptionalBody, minifiedResult, rawTextResult } from '@chrischall/mcp-utils';
import { viewArg, viewResponse } from '../view.js';
import { CONFIRM_NOTE, confirmTokenParam, confirmWrite } from './_confirm.js';
import { UPDATE_MERGE_NOTE, asObj, defined, mergeOverCurrent, revisionOf } from './_merge.js';
import type { McpServer } from '@modelcontextprotocol/server';
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

// Tempo work attribute values travel at the top level of the worklog body as
// `attributes: [{key, value}]` (WorkAttributeValueInput in the v4 spec). Some
// MCP client bridges JSON-serialise array arguments before they reach the
// server, so a well-formed call arrives as the STRING
// '[{"key":"_Account_","value":"20265520"}]' — preprocess attempts JSON.parse
// on strings and falls through to the original value on failure, so zod still
// rejects malformed input with "expected array, received string" instead of
// silently swallowing it.
const WorkAttributes = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(z.object({
  key: z.string().describe('Work attribute key (e.g. _Account_)'),
  value: z.string().describe('Work attribute value (e.g. an account key)'),
})))
  .optional()
  .describe('Tempo work attribute values, e.g. [{"key":"_Account_","value":"20265520"}]. REQUIRED when the Tempo instance marks a work attribute (such as Account) as required — otherwise the write fails with HTTP 400. Discover configured attributes with tempo_get_work_attributes.');

export const WORKLOG_OPTIONAL = ['startTime', 'description', 'billableSeconds', 'remainingEstimateSeconds', 'attributes'] as const;

/**
 * Map a Worklog response to the WorklogUpdate input shape (author.accountId ->
 * authorAccountId, attributes.values -> [{key, value}]). remainingEstimateSeconds
 * is a Jira issue estimate, not part of the worklog, so it has nothing to carry.
 */
function worklogToUpdateInput(raw: unknown): Record<string, unknown> {
  const w = asObj(raw);
  const values = asObj(w.attributes).values;
  const startTime = typeof w.startTime === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(w.startTime) ? w.startTime : undefined;
  return defined({
    authorAccountId: asObj(w.author).accountId,
    startDate: w.startDate,
    startTime,
    timeSpentSeconds: w.timeSpentSeconds,
    billableSeconds: w.billableSeconds,
    description: w.description,
    attributes: Array.isArray(values)
      ? values.map((v) => ({ key: asObj(v).key, value: asObj(v).value }))
      : undefined,
  });
}

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool(
    'tempo_get_worklogs', {
    description: 'Retrieve a list of Tempo worklogs matching the given search parameters. Supports filtering by project, issue, date range, and more.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      projectId: z.array(z.number().int()).optional().describe('Filter by project ids'),
      issueId: z.array(z.number().int()).optional().describe('Filter by issue ids'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset (default 0)'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
      orderBy: z.enum(['ID', 'START_DATE_TIME', 'UPDATED']).optional().describe('Sort order (descending)'),
    }),
  }, async ({ projectId, issueId, from, to, updatedFrom, offset, limit, orderBy, view }) => {
    const data = await client.request('GET', '/4/worklogs', undefined, {
      projectId, issueId, from, to, updatedFrom, offset, limit, orderBy,
    });
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_worklog', {
    description: 'Retrieve a single Tempo worklog by its id.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      id: WorklogId.describe('Worklog id'),
    }),
  }, async ({ id, view }) => {
    const data = await client.request('GET', `/4/worklogs/${id}`);
    return viewResponse(view, data);
  });

  server.registerTool('tempo_create_worklog', {
    description: `Create a new Tempo worklog. ${CONFIRM_NOTE}`,
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: z.object({
      authorAccountId: z.string().describe('Atlassian account id of the worklog author'),
      issueId: z.number().int().describe('Jira issue id to log time against'),
      startDate: IsoDate.describe('Work date (YYYY-MM-DD)'),
      timeSpentSeconds: z.number().int().describe('Time spent in seconds (e.g. 3600 = 1 hour)'),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])(:[0-5][0-9])$/).optional().describe('Start time (HH:mm:ss)'),
      description: z.string().optional().describe('Description of work done'),
      billableSeconds: z.number().int().optional().describe('Billable seconds (defaults to timeSpentSeconds)'),
      remainingEstimateSeconds: z.number().int().optional().describe('Remaining estimate in seconds'),
      attributes: WorkAttributes,
      confirmToken: confirmTokenParam,
    }),
  }, async ({ authorAccountId, issueId, startDate, timeSpentSeconds, confirmToken, ...rest }, ctx) => {
    const body: Record<string, unknown> = {
      authorAccountId,
      issueId,
      startDate,
      timeSpentSeconds,
      ...buildOptionalBody(rest, WORKLOG_OPTIONAL),
    };
    const gate = await confirmWrite(ctx, {
      tool: 'tempo_create_worklog',
      action: 'worklog.create',
      label: `Log ${timeSpentSeconds}s against issue ${issueId} on ${startDate}`,
      method: 'POST',
      path: '/4/worklogs',
      target: String(issueId),
      body,
      confirmToken,
    });
    if (gate) return gate;
    const data = await client.request('POST', '/4/worklogs', body);
    return minifiedResult(data);
  });

  server.registerTool('tempo_update_worklog', {
    description: `Update an existing Tempo worklog by id. Supply only the fields to change. ${UPDATE_MERGE_NOTE} ${CONFIRM_NOTE}`,
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: z.object({
      id: WorklogId.describe('Worklog id'),
      authorAccountId: z.string().optional().describe('Atlassian account id of the worklog author (default: unchanged)'),
      startDate: IsoDate.optional().describe('Work date (YYYY-MM-DD) (default: unchanged)'),
      timeSpentSeconds: z.number().int().optional().describe('Time spent in seconds (default: unchanged)'),
      startTime: z.string().optional().describe('Start time (HH:mm:ss)'),
      description: z.string().optional().describe('Description of work done'),
      billableSeconds: z.number().int().optional().describe('Billable seconds'),
      remainingEstimateSeconds: z.number().int().optional().describe('Remaining estimate in seconds'),
      attributes: WorkAttributes,
      confirmToken: confirmTokenParam,
    }),
  }, async ({ id, confirmToken, ...patch }, ctx) => {
    const raw = await client.request('GET', `/4/worklogs/${id}`);
    const current = worklogToUpdateInput(raw);
    // billableSeconds that merely mirrored timeSpentSeconds is Tempo's default,
    // not a deliberate value — when the time changes, let it follow rather than
    // pinning the old figure.
    if (
      patch.timeSpentSeconds !== undefined &&
      patch.billableSeconds === undefined &&
      current.billableSeconds === current.timeSpentSeconds
    ) {
      delete current.billableSeconds;
    }
    const body = mergeOverCurrent(current, patch);
    const gate = await confirmWrite(ctx, {
      tool: 'tempo_update_worklog',
      action: 'worklog.update',
      label: `Update Tempo worklog ${id}`,
      method: 'PUT',
      path: `/4/worklogs/${id}`,
      target: id,
      body,
      revision: revisionOf(raw),
      confirmToken,
    });
    if (gate) return gate;
    const data = await client.request('PUT', `/4/worklogs/${id}`, body);
    return minifiedResult(data);
  });

  server.registerTool('tempo_delete_worklog', {
    description: `Delete a Tempo worklog by id. bypassPeriodClosuresAndApprovals can rip a worklog out of an already-approved timesheet, so the preview surfaces the bypass flag. ${CONFIRM_NOTE}`,
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: z.object({
      id: WorklogId.describe('Worklog id'),
      bypassPeriodClosuresAndApprovals: z.boolean().optional().describe('Bypass period closures/approvals (requires Tempo Admin + Override Mode) — CAN remove a worklog from an APPROVED timesheet'),
      confirmToken: confirmTokenParam,
    }),
  }, async ({ id, bypassPeriodClosuresAndApprovals, confirmToken }, ctx) => {
    const gate = await confirmWrite(ctx, {
      tool: 'tempo_delete_worklog',
      action: 'worklog.delete',
      label: `Delete Tempo worklog ${id}${bypassPeriodClosuresAndApprovals ? ' — BYPASSING period closures/approvals (can remove it from an APPROVED timesheet)' : ''}`,
      method: 'DELETE',
      path: `/4/worklogs/${id}`,
      target: id,
      // bypassPeriodClosuresAndApprovals travels as a query param, not a body,
      // so surface it under willSendQuery (and omit it entirely when undefined).
      query: { bypassPeriodClosuresAndApprovals },
      confirmToken,
    });
    if (gate) return gate;
    await client.request('DELETE', `/4/worklogs/${id}`, undefined, {
      bypassPeriodClosuresAndApprovals,
    });
    return rawTextResult(`Worklog ${id} deleted successfully`);
  });

  server.registerTool(
    'tempo_search_worklogs', {
    description: 'Search Tempo worklogs using a POST body with advanced filters (author ids, issue ids, project ids, date range). For team or Tempo-account filters use tempo_get_worklogs_by_team / tempo_get_worklogs_by_account.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
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
    }),
  }, async ({ authorIds, issueIds, projectIds, from, to, updatedFrom, orderBy, offset, limit, view }) => {
    const query = buildOptionalBody({ offset, limit }, ['offset', 'limit'] as const);
    const body = buildOptionalBody(
      { authorIds, issueIds, projectIds, from, to, updatedFrom, orderBy },
      ['authorIds', 'issueIds', 'projectIds', 'from', 'to', 'updatedFrom', 'orderBy'] as const
    );
    const data = await client.request('POST', '/4/worklogs/search', body, query);
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_worklogs_by_user', {
    description: 'Retrieve all Tempo worklogs for a specific user (Atlassian account id).',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      accountId: AccountId.describe('Atlassian account id of the user'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ accountId, from, to, updatedFrom, offset, limit, view }) => {
    const data = await client.request('GET', `/4/worklogs/user/${accountId}`, undefined, { from, to, updatedFrom, offset, limit });
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_worklogs_by_project', {
    description: 'Retrieve all Tempo worklogs for a specific Jira project.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      projectId: z.number().int().describe('Jira project id'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ projectId, from, to, updatedFrom, offset, limit, view }) => {
    const data = await client.request('GET', `/4/worklogs/project/${projectId}`, undefined, { from, to, updatedFrom, offset, limit });
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_worklogs_by_issue', {
    description: 'Retrieve all Tempo worklogs for a specific Jira issue.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      issueId: z.number().int().describe('Jira issue id'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ issueId, from, to, updatedFrom, offset, limit, view }) => {
    const data = await client.request('GET', `/4/worklogs/issue/${issueId}`, undefined, { from, to, updatedFrom, offset, limit });
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_worklogs_by_team', {
    description: 'Retrieve all Tempo worklogs for a specific Tempo team.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      teamId: z.number().int().describe('Tempo team id'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ teamId, from, to, updatedFrom, offset, limit, view }) => {
    const data = await client.request('GET', `/4/worklogs/team/${teamId}`, undefined, { from, to, updatedFrom, offset, limit });
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_worklogs_by_account', {
    description: 'Retrieve all Tempo worklogs associated to a Tempo account key.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      accountKey: AccountKey.describe('Tempo account key (e.g. ACCOUNT-123)'),
      from: IsoDate.optional().describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('End date (YYYY-MM-DD)'),
      updatedFrom: z.string().optional().describe('Filter by update date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ accountKey, from, to, updatedFrom, offset, limit, view }) => {
    const data = await client.request('GET', `/4/worklogs/account/${accountKey}`, undefined, { from, to, updatedFrom, offset, limit });
    return viewResponse(view, data);
  });
}
