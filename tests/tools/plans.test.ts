import { describe, it, expect, vi } from 'vitest';
import { register } from '../../src/tools/plans.js';
import { callConfirmed, callPreview } from './_confirm-helpers.js';
import type { TempoClient } from '../../src/client.js';
import type { McpServer } from '@modelcontextprotocol/server';

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
    // planItemIds must be declared in the schema or MCP hosts will reject it
    // before the passthrough handler ever sees it.
    expect(Object.keys((tool.config.inputSchema as { shape: Record<string, unknown> }).shape)).toContain('planItemIds');
    await tool.cb({ from: '2024-01-01', to: '2024-01-31', planItemIds: [598, 599] });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/plans', undefined, expect.objectContaining({
      from: '2024-01-01',
      to: '2024-01-31',
      planItemIds: [598, 599],
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
    await callConfirmed(tool, {
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
    await callConfirmed(tool, {
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
    const result = await callConfirmed(tool, { id: 9 });
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/plans/9');
    expect(result.content[0].text).toContain('deleted successfully');
  });
});

describe('confirm-token gate - plans', () => {
  it('tempo_delete_plan without a confirmToken returns a preview and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_plan');
    const result = await callPreview(tool, { id: 9 });
    expect(client.request).not.toHaveBeenCalled();
    expect(result.status).toBe('confirmation-required');
  });
});

// PUT /4/plans/{id} replaces the whole plan; update must read-merge-write.
describe('tempo_update_plan read-modify-write', () => {
  const CURRENT = {
    id: 5, self: 'x',
    assignee: { id: 'user-1', type: 'USER', self: 'x' },
    planItem: { id: '10001', type: 'ISSUE', self: 'x' },
    startDate: '2024-02-01', endDate: '2024-02-28', startTime: '08:15',
    description: 'Sprint work', effortPersistenceType: 'SECONDS_PER_DAY',
    plannedSecondsPerDay: 14400, totalPlannedSeconds: 288000,
    includeNonWorkingDays: false, rule: 'WEEKLY', recurrenceEndDate: '2024-06-30',
  };

  function rmwClient(): TempoClient {
    const request = vi.fn(async (method: string) => (method === 'GET' ? CURRENT : { id: 5 }));
    return { request } as unknown as TempoClient;
  }

  it('only endDate supplied: GETs the plan and PUTs every other field unchanged', async () => {
    const client = rmwClient();
    const { server, tools } = makeMockServer();
    register(server, client);
    await callConfirmed(findTool(tools, 'tempo_update_plan'), { id: 5, endDate: '2024-03-15' });
    const calls = (client.request as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]).toEqual(['GET', '/4/plans/5']);
    expect(calls[1]).toEqual(['PUT', '/4/plans/5', {
      assigneeId: 'user-1',
      assigneeType: 'USER',
      planItemId: '10001',
      planItemType: 'ISSUE',
      startDate: '2024-02-01',
      endDate: '2024-03-15',
      startTime: '08:15',
      description: 'Sprint work',
      effortPersistenceType: 'SECONDS_PER_DAY',
      plannedSecondsPerDay: 14400,
      includeNonWorkingDays: false,
      rule: 'WEEKLY',
      recurrenceEndDate: '2024-06-30',
    }]);
  });

  it('a TOTAL_SECONDS plan carries totalPlannedSeconds back as plannedSeconds', async () => {
    const request = vi.fn(async (method: string) =>
      method === 'GET' ? { ...CURRENT, effortPersistenceType: 'TOTAL_SECONDS' } : {});
    const client = { request } as unknown as TempoClient;
    const { server, tools } = makeMockServer();
    register(server, client);
    await callConfirmed(findTool(tools, 'tempo_update_plan'), { id: 5, description: 'x' });
    const body = request.mock.calls[1][2] as Record<string, unknown>;
    expect(body.plannedSeconds).toBe(288000);
    expect(body).not.toHaveProperty('plannedSecondsPerDay');
  });

  it('caller-supplied effort replaces the current effort fields wholesale', async () => {
    const client = rmwClient();
    const { server, tools } = makeMockServer();
    register(server, client);
    await callConfirmed(findTool(tools, 'tempo_update_plan'), {
      id: 5, effortPersistenceType: 'TOTAL_SECONDS', plannedSeconds: 36000,
    });
    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[1][2] as Record<string, unknown>;
    expect(body.effortPersistenceType).toBe('TOTAL_SECONDS');
    expect(body.plannedSeconds).toBe(36000);
    expect(body).not.toHaveProperty('plannedSecondsPerDay');
  });

  it('the preview shows the merged body without writing', async () => {
    const client = rmwClient();
    const { server, tools } = makeMockServer();
    register(server, client);
    const result = await callPreview(findTool(tools, 'tempo_update_plan'), { id: 5, endDate: '2024-03-15' });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])).toEqual(['GET']);
    expect(result.preview.willSend.description).toBe('Sprint work');
  });
});
