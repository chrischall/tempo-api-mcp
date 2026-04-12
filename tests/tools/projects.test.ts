import { describe, it, expect, vi } from 'vitest';
import { register } from '../../src/tools/projects.js';
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

describe('project/misc register', () => {
  it('registers 10 tools', () => {
    const { server, tools } = makeMockServer();
    const client = makeClient();
    register(server, client);
    expect(tools.length).toBe(10);
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

describe('tool callbacks - projects/misc', () => {
  it('tempo_get_projects calls GET /4/projects', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_projects');
    await tool.cb({ limit: 10 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/projects', undefined, expect.objectContaining({ limit: 10 }));
  });

  it('tempo_get_project calls GET /4/projects/:id', async () => {
    const client = makeClient({ id: 'proj-1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_project');
    await tool.cb({ id: 'proj-1' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/projects/proj-1');
  });

  it('tempo_get_timesheet_approval_status calls GET with accountId', async () => {
    const client = makeClient({ status: 'OPEN' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_timesheet_approval_status');
    await tool.cb({
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-31',
    });
    expect(client.request).toHaveBeenCalledWith(
      'GET',
      '/4/timesheet-approvals/user/user123',
      undefined,
      expect.objectContaining({ from: '2024-01-01', to: '2024-01-31' })
    );
  });

  it('tempo_get_timesheet_approvals_waiting calls GET /4/timesheet-approvals/waiting', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_timesheet_approvals_waiting');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/timesheet-approvals/waiting', undefined, expect.anything());
  });

  it('tempo_search_timesheet_approval_logs calls POST', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_timesheet_approval_logs');
    await tool.cb({
      accountIds: ['user1'],
      from: '2024-01-01',
    });
    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/4/timesheet-approvals/logs/search',
      expect.objectContaining({ accountIds: ['user1'], from: '2024-01-01' }),
      expect.anything()
    );
  });

  it('tempo_get_periods calls GET /4/periods', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_periods');
    await tool.cb({ from: '2024-01-01', to: '2024-12-31' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/periods', undefined, expect.objectContaining({
      from: '2024-01-01',
      to: '2024-12-31',
    }));
  });

  it('tempo_get_user_schedule calls GET /4/user-schedule', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_user_schedule');
    await tool.cb({
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-07',
    });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/user-schedule', undefined, expect.objectContaining({
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-07',
    }));
  });

  it('tempo_get_global_configuration calls GET /4/globalconfiguration', async () => {
    const client = makeClient({ version: '4' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_global_configuration');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/globalconfiguration');
  });

  it('tempo_get_work_attributes calls GET /4/work-attributes', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_work_attributes');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/work-attributes', undefined, expect.anything());
  });

  it('tempo_get_roles calls GET /4/roles', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_roles');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/roles', undefined, expect.anything());
  });
});
