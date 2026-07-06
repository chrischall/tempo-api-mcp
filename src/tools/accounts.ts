import { z } from 'zod';
import { buildOptionalBody, rawTextResult, textResult } from '@chrischall/mcp-utils';
import { previewUnlessConfirmed, schemaConfirm } from './_confirm.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

// Defence-in-depth against path traversal: account keys are interpolated into
// request paths (e.g. /4/accounts/${key}), so constrain them to the characters
// Tempo actually uses for keys — no slashes, dots, or other traversal vectors.
const AccountKey = z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid account key');

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
    description: 'Retrieve a single Tempo account by its key or numeric id.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      key: AccountKey.describe('Account key (e.g. ACCOUNT-123) or numeric account id'),
    },
  }, async ({ key }) => {
    const data = await client.request('GET', `/4/accounts/${key}`);
    return textResult(data);
  });

  server.registerTool('tempo_search_accounts', {
    description: 'Search Tempo accounts with advanced filters (status, category, project).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      query: z.string().optional().describe('Text search across account name and key'),
      statusList: z.array(z.enum(['OPEN', 'CLOSED', 'ARCHIVED'])).optional().describe('Filter by account status'),
      accountCategoryKeys: z.array(z.string()).optional().describe('Filter by account category keys'),
      projectKeys: z.array(z.string()).optional().describe('Filter by associated Jira project keys'),
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results (default 50)'),
    },
  }, async ({ query, statusList, accountCategoryKeys, projectKeys, offset, limit }) => {
    const qs = buildOptionalBody({ offset, limit }, ['offset', 'limit'] as const);
    const body = buildOptionalBody(
      { query, statusList, accountCategoryKeys, projectKeys },
      ['query', 'statusList', 'accountCategoryKeys', 'projectKeys'] as const
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
    description: 'Retrieve all Tempo account categories.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      offset: z.number().int().optional().describe('Pagination offset'),
      limit: z.number().int().optional().describe('Max results'),
    },
  }, async ({ offset, limit }) => {
    const data = await client.request('GET', '/4/account-categories', undefined, { offset, limit });
    return textResult(data);
  });
}
