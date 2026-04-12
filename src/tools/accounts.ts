import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TempoClient } from '../client.js';

function buildAccountBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { key: args.key, name: args.name };
  if (args.status !== undefined) body.status = args.status;
  if (args.leadAccountId !== undefined) body.leadAccountId = args.leadAccountId;
  if (args.categoryKey !== undefined) body.categoryKey = args.categoryKey;
  if (args.contactAccountId !== undefined) body.contactAccountId = args.contactAccountId;
  if (args.externalContactName !== undefined) body.externalContactName = args.externalContactName;
  if (args.monthlyBudget !== undefined) body.monthlyBudget = args.monthlyBudget;
  return body;
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
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_get_account', {
    description: 'Retrieve a single Tempo account by its key.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      key: z.string().describe('Account key (e.g. ACCOUNT-123)'),
    },
  }, async ({ key }) => {
    const data = await client.request('GET', `/4/accounts/${key}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
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
    const qs: Record<string, unknown> = {};
    if (offset !== undefined) qs.offset = offset;
    if (limit !== undefined) qs.limit = limit;
    const body: Record<string, unknown> = {};
    if (query) body.query = query;
    if (statusList) body.statusList = statusList;
    if (accountCategoryKeys) body.accountCategoryKeys = accountCategoryKeys;
    if (projectKeys) body.projectKeys = projectKeys;
    const data = await client.request('POST', '/4/accounts/search', body, qs);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_create_account', {
    description: 'Create a new Tempo account.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      key: z.string().describe('Unique account key'),
      name: z.string().describe('Account name'),
      status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional().describe('Account status (default OPEN)'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the account lead'),
      categoryKey: z.string().optional().describe('Account category key'),
      contactAccountId: z.string().optional().describe('Atlassian account id of the contact person'),
      externalContactName: z.string().optional().describe('Name of external contact'),
      monthlyBudget: z.number().int().optional().describe('Monthly budget in seconds'),
    },
  }, async (args) => {
    const body = buildAccountBody(args);
    const data = await client.request('POST', '/4/accounts', body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_update_account', {
    description: 'Update an existing Tempo account by its key.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      key: z.string().describe('Account key to update'),
      name: z.string().describe('Account name'),
      status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional().describe('Account status'),
      leadAccountId: z.string().optional().describe('Atlassian account id of the account lead'),
      categoryKey: z.string().optional().describe('Account category key'),
      contactAccountId: z.string().optional().describe('Atlassian account id of the contact person'),
      externalContactName: z.string().optional().describe('Name of external contact'),
      monthlyBudget: z.number().int().optional().describe('Monthly budget in seconds'),
    },
  }, async ({ key, ...rest }) => {
    const body = buildAccountBody({ key, ...rest });
    const data = await client.request('PUT', `/4/accounts/${key}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('tempo_delete_account', {
    description: 'Delete a Tempo account by its key.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      key: z.string().describe('Account key to delete'),
    },
  }, async ({ key }) => {
    await client.request('DELETE', `/4/accounts/${key}`);
    return { content: [{ type: 'text', text: `Account ${key} deleted successfully` }] };
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
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });
}
