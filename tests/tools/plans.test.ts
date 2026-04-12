import { describe, it, expect, vi } from 'vitest';
import { register } from '../../src/tools/plans.js';
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

describe('plan register', () => {
  it('registers 5 tools', () => {
    const { server, tools } = makeMockServer();
    const client = makeClient();
    register(server, client);
    expect(tools.length).toBe(5);
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

describe('tool callbacks - plans', () => {
  it('tempo_get_plans calls GET /4/plans with required dates', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_plans');
    await tool.cb({ from: '2024-01-01', to: '2024-01-31' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/plans', undefined, expect.objectContaining({
      from: '2024-01-01',
      to: '2024-01-31',
    }));
  });

  it('tempo_get_plan calls GET /4/plans/:id', async () => {
    const client = makeClient({ id: 42 });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_plan');
    await tool.cb({ id: 42 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/plans/42');
  });

  it('tempo_create_plan calls POST /4/plans with required fields', async () => {
    const client = makeClient({ id: 1 });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_plan');
    await tool.cb({
      assigneeId: 'user123',
      assigneeType: 'USER',
      planItemId: '10001',
      planItemType: 'ISSUE',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      plannedSecondsPerDay: 28800,
    });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/plans', expect.objectContaining({
      assigneeId: 'user123',
      assigneeType: 'USER',
      planItemId: '10001',
      planItemType: 'ISSUE',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      plannedSecondsPerDay: 28800,
    }));
  });

  it('tempo_update_plan calls PUT /4/plans/:id', async () => {
    const client = makeClient({ id: 5 });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_plan');
    await tool.cb({
      id: 5,
      assigneeId: 'user123',
      assigneeType: 'USER',
      planItemId: '10001',
      planItemType: 'ISSUE',
      startDate: '2024-02-01',
      endDate: '2024-02-28',
    });
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/plans/5', expect.objectContaining({
      assigneeId: 'user123',
      startDate: '2024-02-01',
    }));
  });

  it('tempo_delete_plan calls DELETE /4/plans/:id', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_plan');
    const result = await tool.cb({ id: 9 });
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/plans/9');
    expect(result.content[0].text).toContain('deleted successfully');
  });
});
