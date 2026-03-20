import { describe, it, expect, vi } from 'vitest';
import { handleTool, toolDefinitions } from '../../src/tools/teams.js';
import type { TempoClient } from '../../src/client.js';

function makeClient(returnValue: unknown = {}): TempoClient {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as TempoClient;
}

describe('team toolDefinitions', () => {
  it('exports 7 tools', () => {
    expect(toolDefinitions.length).toBe(7);
  });

  it('all tools have name, description, and inputSchema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});

describe('handleTool - teams', () => {
  it('tempo_get_teams calls GET /4/teams', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_teams', { name: 'Backend', limit: 25 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/teams', undefined, expect.objectContaining({
      name: 'Backend',
      limit: 25,
    }));
  });

  it('tempo_get_team calls GET /4/teams/:id', async () => {
    const client = makeClient({ id: 1 });
    await handleTool('tempo_get_team', { id: 1 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/teams/1');
  });

  it('tempo_create_team calls POST /4/teams', async () => {
    const client = makeClient({ id: 2 });
    await handleTool('tempo_create_team', { name: 'New Team', summary: 'A new team' }, client);
    expect(client.request).toHaveBeenCalledWith('POST', '/4/teams', expect.objectContaining({
      name: 'New Team',
      summary: 'A new team',
    }));
  });

  it('tempo_update_team calls PUT /4/teams/:id', async () => {
    const client = makeClient({ id: 3 });
    await handleTool('tempo_update_team', { id: 3, name: 'Updated Team' }, client);
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/teams/3', expect.objectContaining({ name: 'Updated Team' }));
  });

  it('tempo_delete_team calls DELETE /4/teams/:id', async () => {
    const client = makeClient(undefined);
    const result = await handleTool('tempo_delete_team', { id: 4 }, client);
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/teams/4');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('tempo_get_team_memberships calls GET /4/team-memberships', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_team_memberships', { teamIds: [1, 2] }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/team-memberships', undefined, expect.objectContaining({
      teamIds: [1, 2],
    }));
  });

  it('tempo_search_team_memberships calls POST /4/team-memberships/search', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_search_team_memberships', {
      teamIds: [1],
      from: '2024-01-01',
      to: '2024-03-31',
    }, client);
    expect(client.request).toHaveBeenCalledWith('POST', '/4/team-memberships/search',
      expect.objectContaining({ teamIds: [1], from: '2024-01-01' }),
      expect.anything()
    );
  });

  it('throws for unknown tool name', async () => {
    const client = makeClient();
    await expect(handleTool('unknown_tool', {}, client)).rejects.toThrow('Unknown tool: unknown_tool');
  });
});
