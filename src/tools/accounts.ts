import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TempoClient } from '../client.js';

export const toolDefinitions: Tool[] = [
  {
    name: 'tempo_get_accounts',
    description: 'Retrieve a list of all Tempo accounts (OPEN and CLOSED).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_get_account',
    description: 'Retrieve a single Tempo account by its key.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Account key (e.g. ACCOUNT-123)' },
      },
      required: ['key'],
    },
  },
  {
    name: 'tempo_search_accounts',
    description: 'Search Tempo accounts with advanced filters (status, category, project).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text search across account name and key' },
        statusList: {
          type: 'array',
          items: { type: 'string', enum: ['OPEN', 'CLOSED', 'ARCHIVED'] },
          description: 'Filter by account status',
        },
        accountCategoryKeys: { type: 'array', items: { type: 'string' }, description: 'Filter by account category keys' },
        projectKeys: { type: 'array', items: { type: 'string' }, description: 'Filter by associated Jira project keys' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'tempo_create_account',
    description: 'Create a new Tempo account.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique account key' },
        name: { type: 'string', description: 'Account name' },
        status: { type: 'string', enum: ['OPEN', 'CLOSED', 'ARCHIVED'], description: 'Account status (default OPEN)' },
        leadAccountId: { type: 'string', description: 'Atlassian account id of the account lead' },
        categoryKey: { type: 'string', description: 'Account category key' },
        contactAccountId: { type: 'string', description: 'Atlassian account id of the contact person' },
        externalContactName: { type: 'string', description: 'Name of external contact' },
        monthlyBudget: { type: 'integer', description: 'Monthly budget in seconds' },
      },
      required: ['key', 'name'],
    },
  },
  {
    name: 'tempo_update_account',
    description: 'Update an existing Tempo account by its key.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Account key to update' },
        name: { type: 'string', description: 'Account name' },
        status: { type: 'string', enum: ['OPEN', 'CLOSED', 'ARCHIVED'], description: 'Account status' },
        leadAccountId: { type: 'string', description: 'Atlassian account id of the account lead' },
        categoryKey: { type: 'string', description: 'Account category key' },
        contactAccountId: { type: 'string', description: 'Atlassian account id of the contact person' },
        externalContactName: { type: 'string', description: 'Name of external contact' },
        monthlyBudget: { type: 'integer', description: 'Monthly budget in seconds' },
      },
      required: ['key', 'name'],
    },
  },
  {
    name: 'tempo_delete_account',
    description: 'Delete a Tempo account by its key.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Account key to delete' },
      },
      required: ['key'],
    },
  },
  {
    name: 'tempo_get_account_categories',
    description: 'Retrieve all Tempo account categories.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Max results' },
      },
      required: [],
    },
  },
];

type AccountBody = {
  key: string;
  name: string;
  status?: string;
  leadAccountId?: string;
  categoryKey?: string;
  contactAccountId?: string;
  externalContactName?: string;
  monthlyBudget?: number;
};

function buildAccountBody(args: AccountBody): Record<string, unknown> {
  const body: Record<string, unknown> = { key: args.key, name: args.name };
  if (args.status !== undefined) body.status = args.status;
  if (args.leadAccountId !== undefined) body.leadAccountId = args.leadAccountId;
  if (args.categoryKey !== undefined) body.categoryKey = args.categoryKey;
  if (args.contactAccountId !== undefined) body.contactAccountId = args.contactAccountId;
  if (args.externalContactName !== undefined) body.externalContactName = args.externalContactName;
  if (args.monthlyBudget !== undefined) body.monthlyBudget = args.monthlyBudget;
  return body;
}

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  client: TempoClient
): Promise<CallToolResult> {
  switch (name) {
    case 'tempo_get_accounts': {
      const { offset, limit } = args as { offset?: number; limit?: number };
      const data = await client.request('GET', '/4/accounts', undefined, { offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_get_account': {
      const { key } = args as { key: string };
      const data = await client.request('GET', `/4/accounts/${key}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_search_accounts': {
      const { query, statusList, accountCategoryKeys, projectKeys, offset, limit } = args as {
        query?: string;
        statusList?: string[];
        accountCategoryKeys?: string[];
        projectKeys?: string[];
        offset?: number;
        limit?: number;
      };
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
    }

    case 'tempo_create_account': {
      const body = buildAccountBody(args as AccountBody);
      const data = await client.request('POST', '/4/accounts', body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_update_account': {
      const { key, ...rest } = args as AccountBody;
      const body = buildAccountBody({ key, ...rest });
      const data = await client.request('PUT', `/4/accounts/${key}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'tempo_delete_account': {
      const { key } = args as { key: string };
      await client.request('DELETE', `/4/accounts/${key}`);
      return { content: [{ type: 'text', text: `Account ${key} deleted successfully` }] };
    }

    case 'tempo_get_account_categories': {
      const { offset, limit } = args as { offset?: number; limit?: number };
      const data = await client.request('GET', '/4/account-categories', undefined, { offset, limit });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
