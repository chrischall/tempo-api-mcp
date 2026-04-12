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
    await tool.cb({ key: 'ACCT-1' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/accounts/ACCT-1');
  });

  it('tempo_search_accounts calls POST /4/accounts/search', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_accounts');
    await tool.cb({ statusList: ['OPEN'], query: 'test' });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/accounts/search',
      expect.objectContaining({ statusList: ['OPEN'], query: 'test' }),
      expect.anything()
    );
  });

  it('tempo_create_account calls POST /4/accounts', async () => {
    const client = makeClient({ key: 'NEW-1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_account');
    await tool.cb({ key: 'NEW-1', name: 'New Account', status: 'OPEN' });
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
    await tool.cb({ key: 'ACCT-2', name: 'Updated Account' });
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
    const result = await tool.cb({ key: 'ACCT-3' });
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/accounts/ACCT-3');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('tempo_get_account_categories calls GET /4/account-categories', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_account_categories');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/account-categories', undefined, expect.anything());
  });
});
