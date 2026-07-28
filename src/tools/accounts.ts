import { z } from 'zod';
import { buildOptionalBody, rawTextResult, textResult } from '@chrischall/mcp-utils';
import { previewUnlessConfirmed, schemaConfirm } from './_confirm.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

export function register(server: McpServer, client: TempoClient): void {
  server.registerTool('tempo_get_accounts', {
    description: 'Retrieve a list of all Tempo accounts (OPEN and CLOSED).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ offset, limit }) => {
    const data = await client.request('GET', '/4/accounts', undefined, { offset, limit });
    return textResult(data);
  });

  server.registerTool('tempo_get_account', {
    description: 'Retrieve a single Tempo account by its numeric id. Only update/delete address an account by key — to go from a key to an id, use tempo_search_accounts with keys: ["ACCOUNT-123"].',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.number().int().describe('Numeric account id (not the account key)'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', `/4/accounts/${id}`);
    return textResult(data);
  });

  server.registerTool('tempo_search_accounts', {
    description: 'Search Tempo accounts by id, key, status, or global flag. This is also how you resolve an account key to the numeric id that tempo_get_account needs.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      ids: z.array(z.number().int()).optional().describe('Filter by numeric account ids'),
      keys: z.array(z.string()).optional().describe('Filter by account keys (e.g. ACCOUNT-123)'),
      statuses: z.array(z.enum(['OPEN', 'CLOSED', 'ARCHIVED'])).optional().describe('Filter by account status'),
      global: z.boolean().optional().describe('Filter to global (or non-global) accounts'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ ids, keys, statuses, global: isGlobal, offset, limit }) => {
    const qs = buildOptionalBody({ offset, limit }, ['offset', 'limit'] as const);
    const body = buildOptionalBody(
      { ids, keys, statuses, global: isGlobal },
      ACCOUNT_SEARCH_FILTERS
    );
    const data = await client.request('POST', '/4/accounts/search', body, qs);
    return textResult(data);
  });

  server.registerTool('tempo_create_account', {
    description: 'Create a new Tempo account. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it creates the account.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      key: AccountKey.describe('Unique account key'),
      name: z.string().describe('Account name'),
      status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional().describe('Account status (default OPEN)'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the account lead'),
      categoryKey: z.string().optional().describe('Account category key'),
      contactAccountId: z.string().optional().describe('Atlassian account id of the contact person'),
      externalContactName: z.string().optional().describe('Name of external contact'),
      monthlyBudget: z.number().int().optional().describe('Monthly budget in seconds'),
      confirm: schemaConfirm,
    },
  }, async (args) => {
    const body = buildAccountBody(args);
    const gate = previewUnlessConfirmed(args.confirm as boolean | undefined, `Create Tempo account "${args.key}"`, 'POST', '/4/accounts', body);
    if (gate) return gate;
    const data = await client.request('POST', '/4/accounts', body);
    return textResult(data);
  });

  server.registerTool('tempo_update_account', {
    description: 'Update an existing Tempo account by its key. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the update.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      key: AccountKey.describe('Account key to update'),
      name: z.string().describe('Account name'),
      status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional().describe('Account status'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the account lead'),
      categoryKey: z.string().optional().describe('Account category key'),
      contactAccountId: z.string().optional().describe('Atlassian account id of the contact person'),
      externalContactName: z.string().optional().describe('Name of external contact'),
      monthlyBudget: z.number().int().optional().describe('Monthly budget in seconds'),
      confirm: schemaConfirm,
    },
  }, async ({ key, confirm, ...rest }) => {
    const body = buildAccountBody({ key, ...rest });
    const gate = previewUnlessConfirmed(confirm, `Update Tempo account "${key}"`, 'PUT', `/4/accounts/${key}`, body);
    if (gate) return gate;
    const data = await client.request('PUT', `/4/accounts/${key}`, body);
    return textResult(data);
  });

  server.registerTool('tempo_delete_account', {
    description: 'Delete a Tempo account by its key. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it deletes.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      key: AccountKey.describe('Account key to delete'),
      confirm: schemaConfirm,
    },
  }, async ({ key, confirm }) => {
    const gate = previewUnlessConfirmed(confirm, `Delete Tempo account "${key}"`, 'DELETE', `/4/accounts/${key}`);
    if (gate) return gate;
    await client.request('DELETE', `/4/accounts/${key}`);
    return rawTextResult(`Account ${key} deleted successfully`);
  });

  server.registerTool('tempo_get_account_categories', {
    description: 'Retrieve all Tempo account categories, or a single category when id is given. This endpoint is not paginated.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      id: z.number().int().optional().describe('Return only the category with this id (empty list if it does not exist)'),
    },
  }, async ({ id }) => {
    const data = await client.request('GET', '/4/account-categories', undefined, { id });
    return textResult(data);
  });
}
