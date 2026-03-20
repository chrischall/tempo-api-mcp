import { describe, it, expect, vi } from 'vitest';
import { handleTool, toolDefinitions } from '../../src/tools/plans.js';
import type { TempoClient } from '../../src/client.js';

function makeClient(returnValue: unknown = {}): TempoClient {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as TempoClient;
}

describe('plan toolDefinitions', () => {
  it('exports 5 tools', () => {
    expect(toolDefinitions.length).toBe(5);
  });

  it('all tools have name, description, and inputSchema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});

describe('handleTool - plans', () => {
  it('tempo_get_plans calls GET /4/plans with required dates', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_plans', { from: '2024-01-01', to: '2024-01-31' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/plans', undefined, expect.objectContaining({
      from: '2024-01-01',
      to: '2024-01-31',
    }));
  });

  it('tempo_get_plan calls GET /4/plans/:id', async () => {
    const client = makeClient({ id: 42 });
    await handleTool('tempo_get_plan', { id: 42 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/plans/42');
  });

  it('tempo_create_plan calls POST /4/plans with required fields', async () => {
    const client = makeClient({ id: 1 });
    await handleTool('tempo_create_plan', {
      assigneeId: 'user123',
      assigneeType: 'USER',
      planItemId: '10001',
      planItemType: 'ISSUE',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      plannedSecondsPerDay: 28800,
    }, client);
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
    await handleTool('tempo_update_plan', {
      id: 5,
      assigneeId: 'user123',
      assigneeType: 'USER',
      planItemId: '10001',
      planItemType: 'ISSUE',
      startDate: '2024-02-01',
      endDate: '2024-02-28',
    }, client);
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/plans/5', expect.objectContaining({
      assigneeId: 'user123',
      startDate: '2024-02-01',
    }));
  });

  it('tempo_delete_plan calls DELETE /4/plans/:id', async () => {
    const client = makeClient(undefined);
    const result = await handleTool('tempo_delete_plan', { id: 9 }, client);
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/plans/9');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('throws for unknown tool name', async () => {
    const client = makeClient();
    await expect(handleTool('unknown_tool', {}, client)).rejects.toThrow('Unknown tool: unknown_tool');
  });
});
