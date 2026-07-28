import { describe, it, expect, vi } from 'vitest';
import { register } from '../../src/tools/accounts.js';
import type { TempoClient } from '../../src/client.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ToolEntry = { name: string; config: Record<string, unknown>; cb: Function };

function makeClient(returnValue: unknown = {}): TempoClient {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as TempoClient;
}

function makeMockServer(): { server: McpServer; tools: ToolEntry[] } {
  const tools: ToolEntry[] = [];
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, cb: Function) => {
      tools.push({ name, config, cb });
    }),
  } as unknown as McpServer;
  return { server, tools };
}

function findTool(tools: ToolEntry[], name: string): ToolEntry {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

describe('account register', () => {
  it('registers 7 tools', () => {
    const { server, tools } = makeMockServer();
    const client = makeClient();
    register(server, client);
    expect(tools.length).toBe(7);
  });

  it('all tools have description and annotations', () => {
    const { server, tools } = makeMockServer();
    const client = makeClient();
    register(server, client);
    for (const tool of tools) {
      expect(tool.config.description).toBeTruthy();
      expect(tool.config.annotations).toBeTruthy();
    }
  });
});

describe('tool callbacks - accounts', () => {
  it('tempo_get_accounts calls GET /4/accounts', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_accounts');
    await tool.cb({ limit: 20 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/accounts', undefined, expect.objectContaining({ limit: 20 }));
  });

  it('tempo_get_account calls GET /4/accounts/:key', async () => {
    const client = makeClient({ key: 'ACCT-1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_account');
    await tool.cb({ id: 42 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/accounts/42');
  });

  // GET /4/accounts/{id} takes an integer id; only PUT and DELETE address an
  // account by its string key. Accepting a key here produced a 404.
  it('tempo_get_account takes an integer id, not an account key', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_get_account');
    const schema = tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(Object.keys(tool.config.inputSchema as Record<string, unknown>)).not.toContain('key');
    expect(schema.id.safeParse(42).success).toBe(true);
    expect(schema.id.safeParse('ACCT-1').success).toBe(false);
  });

  it('tempo_search_accounts calls POST /4/accounts/search with the documented filters', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_accounts');
    await tool.cb({ statuses: ['OPEN'], keys: ['ACCT-1'], ids: [42], global: true, limit: 10 });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/accounts/search',
      { statuses: ['OPEN'], keys: ['ACCT-1'], ids: [42], global: true },
      expect.objectContaining({ limit: 10 })
    );
  });

  // AccountSearchInput accepts only {global, ids, keys, statuses}. The old
  // filters were silently dropped by the API, so searches came back unfiltered.
  it('tempo_search_accounts no longer exposes unsupported filters', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_search_accounts');
    const keys = Object.keys(tool.config.inputSchema as Record<string, unknown>);
    expect(keys).not.toContain('query');
    expect(keys).not.toContain('statusList');
    expect(keys).not.toContain('accountCategoryKeys');
    expect(keys).not.toContain('projectKeys');
    expect(keys).toEqual(expect.arrayContaining(['global', 'ids', 'keys', 'statuses']));
  });

  it('tempo_create_account calls POST /4/accounts', async () => {
    const client = makeClient({ key: 'NEW-1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_account');
    await tool.cb({ confirm: true, key: 'NEW-1', name: 'New Account', status: 'OPEN' });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/accounts', expect.objectContaining({
      key: 'NEW-1',
      name: 'New Account',
      status: 'OPEN',
    }));
  });

  it('tempo_update_account calls PUT /4/accounts/:key', async () => {
    const client = makeClient({ key: 'ACCT-2' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_account');
    await tool.cb({ confirm: true, key: 'ACCT-2', name: 'Updated Account' });
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/accounts/ACCT-2', expect.objectContaining({
      key: 'ACCT-2',
      name: 'Updated Account',
    }));
  });

  it('tempo_delete_account calls DELETE /4/accounts/:key', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_account');
    const result = await tool.cb({ confirm: true, key: 'ACCT-3' });
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/accounts/ACCT-3');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('tempo_get_account_categories calls GET /4/account-categories', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_account_categories');
    await tool.cb({ id: 7 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/account-categories', undefined, { id: 7 });
  });

  // The endpoint takes an optional `id` and nothing else — no offset/limit —
  // so advertising pagination promised paging that never happened.
  it('tempo_get_account_categories exposes only the optional id filter', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_get_account_categories');
    const keys = Object.keys(tool.config.inputSchema as Record<string, unknown>);
    expect(keys).toEqual(['id']);
    const schema = tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(schema.id.safeParse(undefined).success).toBe(true);
  });
});

describe('confirm-gate - accounts', () => {
  it('tempo_create_account without confirm returns dry-run and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_account');
    const result = await tool.cb({ key: 'ACC-1', name: 'Acme' });
    expect(client.request).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text as string).dryRun).toBe(true);
  });

  it('tempo_update_account without confirm returns dry-run and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_account');
    const result = await tool.cb({ key: 'ACC-1', name: 'Acme Renamed' });
    expect(client.request).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text as string).dryRun).toBe(true);
  });

  it('tempo_delete_account without confirm returns dry-run and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_account');
    const result = await tool.cb({ key: 'ACC-1' });
    expect(client.request).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text as string).dryRun).toBe(true);
  });
});
