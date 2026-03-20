import { describe, it, expect, vi } from 'vitest';
import { handleTool, toolDefinitions } from '../../src/tools/projects.js';
import type { TempoClient } from '../../src/client.js';

function makeClient(returnValue: unknown = {}): TempoClient {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as TempoClient;
}

describe('project/misc toolDefinitions', () => {
  it('exports 10 tools', () => {
    expect(toolDefinitions.length).toBe(10);
  });

  it('all tools have name, description, and inputSchema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});

describe('handleTool - projects/misc', () => {
  it('tempo_get_projects calls GET /4/projects', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_projects', { limit: 10 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/projects', undefined, expect.objectContaining({ limit: 10 }));
  });

  it('tempo_get_project calls GET /4/projects/:id', async () => {
    const client = makeClient({ id: 'proj-1' });
    await handleTool('tempo_get_project', { id: 'proj-1' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/projects/proj-1');
  });

  it('tempo_get_timesheet_approval_status calls GET with accountId', async () => {
    const client = makeClient({ status: 'OPEN' });
    await handleTool('tempo_get_timesheet_approval_status', {
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-31',
    }, client);
    expect(client.request).toHaveBeenCalledWith(
      'GET',
      '/4/timesheet-approvals/user/user123',
      undefined,
      expect.objectContaining({ from: '2024-01-01', to: '2024-01-31' })
    );
  });

  it('tempo_get_timesheet_approvals_waiting calls GET /4/timesheet-approvals/waiting', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_timesheet_approvals_waiting', {}, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/timesheet-approvals/waiting', undefined, expect.anything());
  });

  it('tempo_search_timesheet_approval_logs calls POST', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_search_timesheet_approval_logs', {
      accountIds: ['user1'],
      from: '2024-01-01',
    }, client);
    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/4/timesheet-approvals/logs/search',
      expect.objectContaining({ accountIds: ['user1'], from: '2024-01-01' }),
      expect.anything()
    );
  });

  it('tempo_get_periods calls GET /4/periods', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_periods', { from: '2024-01-01', to: '2024-12-31' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/periods', undefined, expect.objectContaining({
      from: '2024-01-01',
      to: '2024-12-31',
    }));
  });

  it('tempo_get_user_schedule calls GET /4/user-schedule', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_user_schedule', {
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-07',
    }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/user-schedule', undefined, expect.objectContaining({
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-07',
    }));
  });

  it('tempo_get_global_configuration calls GET /4/globalconfiguration', async () => {
    const client = makeClient({ version: '4' });
    await handleTool('tempo_get_global_configuration', {}, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/globalconfiguration');
  });

  it('tempo_get_work_attributes calls GET /4/work-attributes', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_work_attributes', {}, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/work-attributes', undefined, expect.anything());
  });

  it('tempo_get_roles calls GET /4/roles', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_roles', {}, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/roles', undefined, expect.anything());
  });

  it('throws for unknown tool name', async () => {
    const client = makeClient();
    await expect(handleTool('unknown_tool', {}, client)).rejects.toThrow('Unknown tool: unknown_tool');
  });
});
