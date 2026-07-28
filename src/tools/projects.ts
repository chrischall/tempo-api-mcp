import { z } from 'zod';
import { buildOptionalBody, IsoDate, textResult } from '@chrischall/mcp-utils';
import { previewUnlessConfirmed, schemaConfirm } from './_confirm.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

// Defence-in-depth against path traversal: Atlassian account ids are
// interpolated into request paths (e.g. /4/timesheet-approvals/user/${id}).
// `.` is allowed (some ids contain it) but `..` is rejected so no path segment
// can climb the URL.
const AccountId = z
  .string()
  .regex(/^[A-Za-z0-9:_.-]+$/, 'Invalid account id')
  .refine((v) => !v.includes('..'), 'Invalid account id');
// Project ids are interpolated into paths too (/4/projects/${id}) — same
// defence-in-depth: no slashes, dots, or query/fragment characters.
const ProjectId = z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid project id');

const APPROVAL_BODY = ['comment', 'reviewerAccountId'] as const;

// The five timesheet state transitions Tempo exposes at
// POST /4/timesheet-approvals/user/{accountId}/{action}. They share one request
// shape — period as query params, an optional comment/reviewer body — so they
// are registered from this table rather than hand-rolled five times over.
const TIMESHEET_ACTIONS = [
  {
    action: 'submit',
    tool: 'tempo_submit_timesheet',
    verb: 'Submit',
    detail: "Submit a user's timesheet for the given period for approval, moving it from OPEN to WAITING_FOR_APPROVAL.",
  },
  {
    action: 'approve',
    tool: 'tempo_approve_timesheet',
    verb: 'Approve',
    detail: "Approve a user's submitted timesheet for the given period. Reviewer action — approving locks the period's worklogs against further edits.",
  },
  {
    action: 'reject',
    tool: 'tempo_reject_timesheet',
    verb: 'Reject',
    detail: "Reject a user's submitted timesheet for the given period, sending it back to the user for changes. Reviewer action — supply a comment explaining why.",
  },
  {
    action: 'reopen',
    tool: 'tempo_reopen_timesheet',
    verb: 'Reopen',
    detail: "Reopen a user's already-approved timesheet for the given period, returning it to OPEN so worklogs can be edited again. Reviewer action — this undoes an approval.",
  },
  {
    action: 'recall',
    tool: 'tempo_recall_timesheet',
    verb: 'Recall',
    detail: "Recall a user's own timesheet that was submitted but not yet approved, returning it to OPEN so it can be corrected and resubmitted.",
  },
] as const;

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
    return textResult(data);
  });

  server.registerTool('tempo_get_project', {
    description: 'Retrieve a single Tempo Financial Manager project by id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: ProjectId.describe('Project id'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/projects/${id}`);
    return textResult(data);
  });

  server.registerTool('tempo_get_timesheet_approval_status', {
    description: 'Retrieve the current timesheet approval status for a user in the given period.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountId: AccountId.describe('Atlassian account id of the user'),
      from: IsoDate.describe('Period start date (YYYY-MM-DD)'),
      to: IsoDate.optional().describe('Period end date (YYYY-MM-DD); defaults to the period containing `from`'),
    },
  }, async ({ accountId, from, to }) => {
    const data = await client.request('GET', `/4/timesheet-approvals/user/${accountId}`, undefined, { from, to });
    return textResult(data);
  });

  server.registerTool('tempo_get_timesheet_approvals_waiting', {
    description: 'Retrieve all timesheets that are currently waiting for approval.',
    annotations: { readOnlyHint: true },
  }, async () => {
    const data = await client.request('GET', '/4/timesheet-approvals/waiting');
    return textResult(data);
  });

  server.registerTool('tempo_search_timesheet_approval_logs', {
    description: 'Search timesheet approval audit logs. Requires appropriate Tempo permissions; results may contain PII (account ids, reviewer actions). Paginated via nextPageToken from the previous response.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      userAccountIds: z.array(z.string()).optional().describe('Filter by Atlassian account ids of the timesheet users'),
      updatedFrom: z.string().optional().describe('Logs updated from this date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ, within past 2 years)'),
      nextPageToken: z.string().optional().describe('Page token from the previous response metadata'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ userAccountIds, updatedFrom, nextPageToken, limit }) => {
    const qs = buildOptionalBody({ nextPageToken, limit }, ['nextPageToken', 'limit'] as const);
    const body = buildOptionalBody(
      { userAccountIds, updatedFrom },
      ['userAccountIds', 'updatedFrom'] as const
    );
    const data = await client.request('POST', '/4/timesheet-approvals/logs/search', body, qs);
    return textResult(data);
  });

  for (const { action, tool, verb, detail } of TIMESHEET_ACTIONS) {
    server.registerTool(tool, {
      description: `${detail} Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the change.`,
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        accountId: AccountId.describe('Atlassian account id of the timesheet owner'),
        from: IsoDate.describe('Period start date (YYYY-MM-DD) — use tempo_get_periods to find valid period boundaries'),
        to: IsoDate.optional().describe('Period end date (YYYY-MM-DD); defaults to the period containing `from`'),
        comment: z.string().optional().describe('Comment recorded against the approval action'),
        reviewerAccountId: z.string().optional().describe('Atlassian account id of the reviewer (see tempo_get_timesheet_approvals_waiting)'),
        confirm: schemaConfirm,
      },
    }, async ({ accountId, from, to, comment, reviewerAccountId, confirm }) => {
      const path = `/4/timesheet-approvals/user/${accountId}/${action}`;
      const query = { from, to };
      const fields = buildOptionalBody({ comment, reviewerAccountId }, APPROVAL_BODY);
      // The request body is optional upstream — send nothing rather than `{}`
      // when the caller supplied neither field.
      const body = Object.keys(fields).length > 0 ? fields : undefined;
      const gate = previewUnlessConfirmed(
        confirm,
        `${verb} timesheet for ${accountId} covering ${from}${to ? ` to ${to}` : ''}`,
        'POST',
        path,
        body,
        query,
      );
      if (gate) return gate;
      const data = await client.request('POST', path, body, query);
      return textResult(data);
    });
  }

  server.registerTool('tempo_get_periods', {
    description: 'Retrieve Tempo period definitions (used for timesheet approval cycles).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      from: IsoDate.describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.describe('End date (YYYY-MM-DD)'),
    },
  }, async ({ from, to }) => {
    const data = await client.request('GET', '/4/periods', undefined, { from, to });
    return textResult(data);
  });

  server.registerTool('tempo_get_user_schedule', {
    description: 'Retrieve the work schedule for a user, including planned working hours per day.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      accountId: AccountId.describe('Atlassian account id of the user'),
      from: IsoDate.describe('Start date (YYYY-MM-DD)'),
      to: IsoDate.describe('End date (YYYY-MM-DD)'),
    },
  }, async ({ accountId, from, to }) => {
    const data = await client.request('GET', `/4/user-schedule/${accountId}`, undefined, { from, to });
    return textResult(data);
  });

  server.registerTool('tempo_get_global_configuration', {
    description: 'Retrieve the global Tempo configuration settings.',
    annotations: { readOnlyHint: true },
  }, async () => {
    const data = await client.request('GET', '/4/globalconfiguration');
    return textResult(data);
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
    return textResult(data);
  });

  server.registerTool('tempo_get_roles', {
    description: 'Retrieve all Tempo roles.',
    annotations: { readOnlyHint: true },
  }, async () => {
    const data = await client.request('GET', '/4/roles');
    return textResult(data);
  });
}
