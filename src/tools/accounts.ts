import { z } from 'zod';
import { buildOptionalBody, CONFIRM_FLOW_SENTENCE, confirmTokenParam, confirmWrite, MERGED_UPDATE_NOTE, minifiedResult, prepareMergedUpdate, rawTextResult } from '@chrischall/mcp-utils';
import { viewArg, viewResponse } from '../view.js';
import { asObj, defined } from './_input.js';
import type { McpServer } from '@modelcontextprotocol/server';
import type { TempoClient } from '../client.js';

// Defence-in-depth against path traversal: account keys are interpolated into
// request paths (e.g. /4/accounts/${key}), so constrain them to the characters
// Tempo actually uses for keys — no slashes, dots, or other traversal vectors.
const AccountKey = z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid account key');

// AccountSearchInput accepts exactly these four filters — anything else is
// dropped on the floor by the API, which reads as an unfiltered result set
// rather than an error.
const ACCOUNT_SEARCH_FILTERS = ['ids', 'keys', 'statuses', 'global'] as const;

const ACCOUNT_REQUIRED = ['key', 'name'] as const;
const ACCOUNT_OPTIONAL = [
  'status',
  'leadAccountId',
  'categoryKey',
  'contactAccountId',
  'externalContactName',
  'monthlyBudget',
] as const;

function buildAccountBody(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ...buildOptionalBody(args, ACCOUNT_REQUIRED),
    ...buildOptionalBody(args, ACCOUNT_OPTIONAL),
  };
}

/**
 * Map an Account response to the AccountInput shape so an update can carry
 * forward everything the caller didn't change — including customerKey and
 * global, which the tool doesn't expose but a full-replace PUT would reset.
 */
function accountToInput(raw: unknown): Record<string, unknown> {
  const a = asObj(raw);
  const contact = asObj(a.contact);
  return defined({
    key: a.key,
    name: a.name,
    status: a.status,
    global: a.global,
    leadAccountId: asObj(a.lead).accountId,
    categoryKey: asObj(a.category).key,
    contactAccountId: contact.type === 'EXTERNAL' ? undefined : contact.accountId,
    externalContactName: contact.type === 'EXTERNAL' ? contact.name : undefined,
    customerKey: asObj(a.customer).key,
    monthlyBudget: a.monthlyBudget,
  });
}

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool(
    'tempo_get_accounts', {
    description: 'Retrieve a list of all Tempo accounts (OPEN and CLOSED).',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ offset, limit, view }) => {
    const data = await client.request('GET', '/4/accounts', undefined, { offset, limit });
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_get_account', {
    description: 'Retrieve a single Tempo account by its numeric id. Only update/delete address an account by key — to go from a key to an id, use tempo_search_accounts with keys: ["ACCOUNT-123"].',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      id: z.number().int().describe('Numeric account id (not the account key)'),
    }),
  }, async ({ id, view }) => {
    const data = await client.request('GET', `/4/accounts/${id}`);
    return viewResponse(view, data);
  });

  server.registerTool(
    'tempo_search_accounts', {
    description: 'Search Tempo accounts by id, key, status, or global flag. This is also how you resolve an account key to the numeric id that tempo_get_account needs.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      ids: z.array(z.number().int()).optional().describe('Filter by numeric account ids'),
      keys: z.array(z.string()).optional().describe('Filter by account keys (e.g. ACCOUNT-123)'),
      statuses: z.array(z.enum(['OPEN', 'CLOSED', 'ARCHIVED'])).optional().describe('Filter by account status'),
      global: z.boolean().optional().describe('Filter to global (or non-global) accounts'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    }),
  }, async ({ ids, keys, statuses, global: isGlobal, offset, limit, view }) => {
    const qs = buildOptionalBody({ offset, limit }, ['offset', 'limit'] as const);
    const body = buildOptionalBody(
      { ids, keys, statuses, global: isGlobal },
      ACCOUNT_SEARCH_FILTERS
    );
    const data = await client.request('POST', '/4/accounts/search', body, qs);
    return viewResponse(view, data);
  });

  server.registerTool('tempo_create_account', {
    description: `Create a new Tempo account. ${CONFIRM_FLOW_SENTENCE}`,
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: z.object({
      key: AccountKey.describe('Unique account key'),
      name: z.string().describe('Account name'),
      status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional().describe('Account status (default OPEN)'),
      leadAccountId: z.string().min(1).describe('Atlassian account id of the account lead (required by Tempo)'),
      categoryKey: z.string().optional().describe('Account category key'),
      contactAccountId: z.string().optional().describe('Atlassian account id of the contact person'),
      externalContactName: z.string().optional().describe('Name of external contact'),
      monthlyBudget: z.number().int().optional().describe('Monthly budget in seconds'),
      confirmToken: confirmTokenParam,
    }),
  }, async ({ confirmToken, ...args }, ctx) => {
    // AccountInput requires status; honour the documented default here so a
    // call that omits it is not a 400 after the user has confirmed.
    const body = buildAccountBody({ ...args, status: args.status ?? 'OPEN' });
    const gate = await confirmWrite(ctx, {
      tool: 'tempo_create_account',
      action: 'account.create',
      summary: `Create Tempo account "${args.key}"`,
      account: undefined,
      target: args.key,
      request: { method: 'POST', path: '/4/accounts', body },
      confirmToken,
    });
    if (gate) return gate;
    const data = await client.request('POST', '/4/accounts', body);
    return minifiedResult(data);
  });

  server.registerTool('tempo_update_account', {
    description: `Update an existing Tempo account by its key. Supply only the fields to change. ${MERGED_UPDATE_NOTE} ${CONFIRM_FLOW_SENTENCE}`,
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: z.object({
      key: AccountKey.describe('Account key to update'),
      name: z.string().optional().describe('Account name (default: unchanged)'),
      status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional().describe('Account status'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the account lead'),
      categoryKey: z.string().optional().describe('Account category key'),
      contactAccountId: z.string().optional().describe('Atlassian account id of the contact person'),
      externalContactName: z.string().optional().describe('Name of external contact'),
      monthlyBudget: z.number().int().optional().describe('Monthly budget in seconds'),
      confirmToken: confirmTokenParam,
    }),
  }, async ({ key, confirmToken, ...patch }, ctx) => {
    const { body } = await prepareMergedUpdate({
      // PUT is by key but GET is by numeric id, so resolve the key via search.
      read: async () => {
        const found = asObj(await client.request('POST', '/4/accounts/search', { keys: [key] })).results;
        const current = Array.isArray(found) ? found.find((a) => asObj(a).key === key) : undefined;
        if (!current) throw new Error(`Tempo account "${key}" not found`);
        return current;
      },
      toInput: accountToInput,
      patch: { key, ...patch },
      // A contact is EITHER a Jira user or an external name — setting one must
      // not leave the other behind.
      adjust: (base) => {
        if (patch.contactAccountId !== undefined) delete base.externalContactName;
        if (patch.externalContactName !== undefined) delete base.contactAccountId;
      },
      // A Tempo account carries no updatedAt; the token binds the merged body.
      revision: false,
    });
    const gate = await confirmWrite(ctx, {
      tool: 'tempo_update_account',
      action: 'account.update',
      summary: `Update Tempo account "${key}"`,
      account: undefined,
      target: key,
      request: { method: 'PUT', path: `/4/accounts/${key}`, body },
      confirmToken,
    });
    if (gate) return gate;
    const data = await client.request('PUT', `/4/accounts/${key}`, body);
    return minifiedResult(data);
  });

  server.registerTool('tempo_delete_account', {
    description: `Delete a Tempo account by its key. ${CONFIRM_FLOW_SENTENCE}`,
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: z.object({
      key: AccountKey.describe('Account key to delete'),
      confirmToken: confirmTokenParam,
    }),
  }, async ({ key, confirmToken }, ctx) => {
    const gate = await confirmWrite(ctx, {
      tool: 'tempo_delete_account',
      action: 'account.delete',
      summary: `Delete Tempo account "${key}"`,
      account: undefined,
      target: key,
      request: { method: 'DELETE', path: `/4/accounts/${key}` },
      confirmToken,
    });
    if (gate) return gate;
    await client.request('DELETE', `/4/accounts/${key}`);
    return rawTextResult(`Account ${key} deleted successfully`);
  });

  server.registerTool(
    'tempo_get_account_categories', {
    description: 'Retrieve all Tempo account categories, or a single category when id is given. This endpoint is not paginated.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      view: viewArg(),
      id: z.number().int().optional().describe('Return only the category with this id (empty list if it does not exist)'),
    }),
  }, async ({ id, view }) => {
    const data = await client.request('GET', '/4/account-categories', undefined, { id });
    return viewResponse(view, data);
  });
}
