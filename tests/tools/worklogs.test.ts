import { describe, it, expect, vi } from 'vitest';
import { register } from '../../src/tools/worklogs.js';
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

describe('worklog register', () => {
  it('registers at least 10 tools', () => {
    const { server, tools } = makeMockServer();
    const client = makeClient();
    register(server, client);
    expect(tools.length).toBeGreaterThanOrEqual(10);
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

describe('tool callbacks - worklogs', () => {
  it('tempo_get_worklogs calls GET /4/worklogs', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs');
    const result = await tool.cb({ from: '2024-01-01', limit: 10 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs', undefined, expect.objectContaining({ from: '2024-01-01', limit: 10 }));
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('tempo_get_worklog calls GET /4/worklogs/:id', async () => {
    const client = makeClient({ id: '42' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklog');
    const result = await tool.cb({ id: '42' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/42');
    expect(result.content[0].text).toContain('"id"');
  });

  it('tempo_create_worklog calls POST /4/worklogs', async () => {
    const client = makeClient({ id: '1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_worklog');
    await tool.cb({
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
      description: 'Test work',
    });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/worklogs', expect.objectContaining({
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
      description: 'Test work',
    }));
  });

  it('tempo_create_worklog omits optional fields when not provided', async () => {
    const client = makeClient({ id: '1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_worklog');
    await tool.cb({
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
    });
    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(body.description).toBeUndefined();
    expect(body.startTime).toBeUndefined();
  });

  it('tempo_update_worklog calls PUT /4/worklogs/:id', async () => {
    const client = makeClient({ id: '5' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_worklog');
    await tool.cb({
      id: '5',
      authorAccountId: 'abc',
      startDate: '2024-01-15',
      timeSpentSeconds: 7200,
    });
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/worklogs/5', expect.objectContaining({
      authorAccountId: 'abc',
      startDate: '2024-01-15',
      timeSpentSeconds: 7200,
    }));
  });

  it('tempo_delete_worklog calls DELETE /4/worklogs/:id', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_worklog');
    const result = await tool.cb({ id: '7' });
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/worklogs/7', undefined, expect.anything());
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('tempo_search_worklogs calls POST /4/worklogs/search', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_worklogs');
    await tool.cb({
      authorIds: ['abc123'],
      from: '2024-01-01',
      to: '2024-01-31',
    });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/worklogs/search',
      expect.objectContaining({ authorIds: ['abc123'], from: '2024-01-01', to: '2024-01-31' }),
      expect.anything()
    );
  });

  it('tempo_get_worklogs_by_user calls GET /4/worklogs/user/:accountId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs_by_user');
    await tool.cb({ accountId: 'user123', from: '2024-01-01' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/user/user123', undefined, expect.objectContaining({ from: '2024-01-01' }));
  });

  it('tempo_get_worklogs_by_project calls GET /4/worklogs/project/:projectId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs_by_project');
    await tool.cb({ projectId: 10100 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/project/10100', undefined, expect.anything());
  });

  it('tempo_get_worklogs_by_issue calls GET /4/worklogs/issue/:issueId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs_by_issue');
    await tool.cb({ issueId: 50001 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/issue/50001', undefined, expect.anything());
  });

  it('tempo_get_worklogs_by_team calls GET /4/worklogs/team/:teamId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs_by_team');
    await tool.cb({ teamId: 3 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/team/3', undefined, expect.anything());
  });

  it('tempo_get_worklogs_by_account calls GET /4/worklogs/account/:accountKey', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs_by_account');
    await tool.cb({ accountKey: 'ACCT-1' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/account/ACCT-1', undefined, expect.anything());
  });
});
