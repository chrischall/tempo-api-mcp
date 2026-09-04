import { describe, it, expect, vi } from 'vitest';
import { register } from '../../src/tools/teams.js';
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

describe('team register', () => {
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

describe('tool callbacks - teams', () => {
  it('tempo_get_teams calls GET /4/teams', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_teams');
    await tool.cb({ name: 'Backend', limit: 25 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/teams', undefined, expect.objectContaining({
      name: 'Backend',
      limit: 25,
    }));
  });

  it('tempo_get_team calls GET /4/teams/:id', async () => {
    const client = makeClient({ id: 1 });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_team');
    await tool.cb({ id: 1 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/teams/1');
  });

  it('tempo_create_team calls POST /4/teams', async () => {
    const client = makeClient({ id: 2 });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_team');
    await tool.cb({ confirm: true, name: 'New Team', summary: 'A new team' });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/teams', expect.objectContaining({
      name: 'New Team',
      summary: 'A new team',
    }));
  });

  it('tempo_update_team calls PUT /4/teams/:id', async () => {
    const client = makeClient({ id: 3 });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_team');
    await tool.cb({ confirm: true, id: 3, name: 'Updated Team' });
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/teams/3', expect.objectContaining({ name: 'Updated Team' }));
  });

  it('tempo_delete_team calls DELETE /4/teams/:id', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_team');
    const result = await tool.cb({ confirm: true, id: 4 });
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/teams/4');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  // There is no GET /4/team-memberships collection endpoint — that path is
  // POST-only (create). Memberships are listed per team.
  it('tempo_get_team_memberships calls GET /4/team-memberships/team/:teamId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_team_memberships');
    await tool.cb({ teamId: 42 });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/team-memberships/team/42');
  });

  it('tempo_get_team_memberships requires a single numeric teamId', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_get_team_memberships');
    const keys = Object.keys(tool.config.inputSchema as Record<string, unknown>);
    expect(keys).toEqual(['view', 'teamId']);
    const schema = tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(schema.teamId.safeParse(42).success).toBe(true);
    expect(schema.teamId.safeParse(undefined).success).toBe(false);
    expect(schema.teamId.safeParse('42/../teams').success).toBe(false);
  });

  it('tempo_search_team_memberships calls POST /4/team-memberships/search', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_team_memberships');
    await tool.cb({
      teamIds: [1],
      accountIds: ['user1'],
      roleIds: [3],
      limit: 10,
    });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/team-memberships/search',
      { teamIds: [1], accountIds: ['user1'], roleIds: [3] },
      expect.objectContaining({ limit: 10 })
    );
  });

  // MembershipSearchInput accepts only {accountIds, roleIds, teamIds} — the
  // from/to date filters were silently ignored by the API.
  it('tempo_search_team_memberships drops the unsupported date filters and adds roleIds', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_search_team_memberships');
    const keys = Object.keys(tool.config.inputSchema as Record<string, unknown>);
    expect(keys).not.toContain('from');
    expect(keys).not.toContain('to');
    expect(keys).toEqual(expect.arrayContaining(['teamIds', 'accountIds', 'roleIds']));
  });
});

describe('confirm-gate - teams', () => {
  it('tempo_create_team without confirm returns dry-run and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_team');
    const result = await tool.cb({ name: 'Platform' });
    expect(client.request).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text as string).dryRun).toBe(true);
  });

  it('tempo_update_team without confirm returns dry-run and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_team');
    const result = await tool.cb({ id: 1, name: 'Platform Renamed' });
    expect(client.request).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text as string).dryRun).toBe(true);
  });

  it('tempo_delete_team without confirm returns dry-run and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_team');
    const result = await tool.cb({ id: 1 });
    expect(client.request).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text as string).dryRun).toBe(true);
  });
});
