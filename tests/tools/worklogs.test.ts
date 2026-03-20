import { describe, it, expect, vi } from 'vitest';
import { handleTool, toolDefinitions } from '../../src/tools/worklogs.js';
import type { TempoClient } from '../../src/client.js';

function makeClient(returnValue: unknown = {}): TempoClient {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as TempoClient;
}

describe('worklog toolDefinitions', () => {
  it('exports at least 10 tools', () => {
    expect(toolDefinitions.length).toBeGreaterThanOrEqual(10);
  });

  it('all tools have name, description, and inputSchema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});

describe('handleTool - worklogs', () => {
  it('tempo_get_worklogs calls GET /4/worklogs', async () => {
    const client = makeClient({ results: [] });
    const result = await handleTool('tempo_get_worklogs', { from: '2024-01-01', limit: 10 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs', undefined, expect.objectContaining({ from: '2024-01-01', limit: 10 }));
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('tempo_get_worklog calls GET /4/worklogs/:id', async () => {
    const client = makeClient({ id: '42' });
    const result = await handleTool('tempo_get_worklog', { id: '42' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/42');
    expect(result.content[0].text).toContain('"id"');
  });

  it('tempo_create_worklog calls POST /4/worklogs', async () => {
    const client = makeClient({ id: '1' });
    await handleTool('tempo_create_worklog', {
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
      description: 'Test work',
    }, client);
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
    await handleTool('tempo_create_worklog', {
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
    }, client);
    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(body.description).toBeUndefined();
    expect(body.startTime).toBeUndefined();
  });

  it('tempo_update_worklog calls PUT /4/worklogs/:id', async () => {
    const client = makeClient({ id: '5' });
    await handleTool('tempo_update_worklog', {
      id: '5',
      authorAccountId: 'abc',
      startDate: '2024-01-15',
      timeSpentSeconds: 7200,
    }, client);
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/worklogs/5', expect.objectContaining({
      authorAccountId: 'abc',
      startDate: '2024-01-15',
      timeSpentSeconds: 7200,
    }));
  });

  it('tempo_delete_worklog calls DELETE /4/worklogs/:id', async () => {
    const client = makeClient(undefined);
    const result = await handleTool('tempo_delete_worklog', { id: '7' }, client);
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/worklogs/7', undefined, expect.anything());
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('tempo_search_worklogs calls POST /4/worklogs/search', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_search_worklogs', {
      authorIds: ['abc123'],
      from: '2024-01-01',
      to: '2024-01-31',
    }, client);
    expect(client.request).toHaveBeenCalledWith('POST', '/4/worklogs/search',
      expect.objectContaining({ authorIds: ['abc123'], from: '2024-01-01', to: '2024-01-31' }),
      expect.anything()
    );
  });

  it('tempo_get_worklogs_by_user calls GET /4/worklogs/user/:accountId', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_worklogs_by_user', { accountId: 'user123', from: '2024-01-01' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/user/user123', undefined, expect.objectContaining({ from: '2024-01-01' }));
  });

  it('tempo_get_worklogs_by_project calls GET /4/worklogs/project/:projectId', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_worklogs_by_project', { projectId: 10100 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/project/10100', undefined, expect.anything());
  });

  it('tempo_get_worklogs_by_issue calls GET /4/worklogs/issue/:issueId', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_worklogs_by_issue', { issueId: 50001 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/issue/50001', undefined, expect.anything());
  });

  it('tempo_get_worklogs_by_team calls GET /4/worklogs/team/:teamId', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_worklogs_by_team', { teamId: 3 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/team/3', undefined, expect.anything());
  });

  it('tempo_get_worklogs_by_account calls GET /4/worklogs/account/:accountKey', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_worklogs_by_account', { accountKey: 'ACCT-1' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/account/ACCT-1', undefined, expect.anything());
  });

  it('throws for unknown tool name', async () => {
    const client = makeClient();
    await expect(handleTool('unknown_tool', {}, client)).rejects.toThrow('Unknown tool: unknown_tool');
  });
});
