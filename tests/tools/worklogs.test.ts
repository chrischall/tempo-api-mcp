import { describe, it, expect, vi } from 'vitest';
import { register, WORKLOG_OPTIONAL } from '../../src/tools/worklogs.js';
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
    await tool.cb({ confirm: true,
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
      confirm: true,
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
    await tool.cb({ confirm: true,
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
    const result = await tool.cb({ confirm: true, id: '7' });
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

  it('tempo_search_worklogs supports orderBy and drops unsupported team/account filters', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_worklogs');
    // teamIds/accountIds are not in WorklogSearchInput — the API silently
    // ignores them, so exposing them would return unfiltered results.
    const keys = Object.keys(tool.config.inputSchema as Record<string, unknown>);
    expect(keys).not.toContain('teamIds');
    expect(keys).not.toContain('accountIds');
    await tool.cb({ orderBy: [{ field: 'UPDATED', order: 'DESC' }] });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/worklogs/search',
      expect.objectContaining({ orderBy: [{ field: 'UPDATED', order: 'DESC' }] }),
      expect.anything()
    );
  });

  it('tempo_get_worklogs_by_user calls GET /4/worklogs/user/:accountId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_worklogs_by_user');
    await tool.cb({ accountId: 'user123', from: '2024-01-01', updatedFrom: '2024-01-15' });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/worklogs/user/user123', undefined, expect.objectContaining({ from: '2024-01-01', updatedFrom: '2024-01-15' }));
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

describe('worklog id path-traversal hardening', () => {
  // Worklog ids are interpolated into request paths
  // (/4/worklogs/${id}), so the input schema must reject anything that
  // could introduce a path separator or traversal sequence.
  function idSchemaOf(name: string) {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, name);
    return (tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>).id;
  }

  for (const name of ['tempo_get_worklog', 'tempo_update_worklog', 'tempo_delete_worklog']) {
    it(`${name} rejects ids containing slashes or traversal sequences`, () => {
      const id = idSchemaOf(name);
      expect(id.safeParse('126').success).toBe(true);
      expect(id.safeParse('../periods').success).toBe(false);
      expect(id.safeParse('1/approvals').success).toBe(false);
      expect(id.safeParse('1?bypass=true').success).toBe(false);
      expect(id.safeParse('1#frag').success).toBe(false);
    });
  }
});

// All five GET /4/worklogs/{scope} variants accept updatedFrom upstream, but
// only the by-user tool passed it through — the rest silently dropped the
// caller's filter and returned the full window.
describe.each([
  ['tempo_get_worklogs_by_user', { accountId: 'user1' }, '/4/worklogs/user/user1'],
  ['tempo_get_worklogs_by_project', { projectId: 10 }, '/4/worklogs/project/10'],
  ['tempo_get_worklogs_by_issue', { issueId: 20 }, '/4/worklogs/issue/20'],
  ['tempo_get_worklogs_by_team', { teamId: 30 }, '/4/worklogs/team/30'],
  ['tempo_get_worklogs_by_account', { accountKey: 'ACCT-1' }, '/4/worklogs/account/ACCT-1'],
] as const)('%s', (toolName, idArg, path) => {
  it('forwards updatedFrom to the API', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, toolName);
    await tool.cb({ ...idArg, from: '2024-01-01', updatedFrom: '2024-02-01' });
    expect(client.request).toHaveBeenCalledWith('GET', path, undefined,
      expect.objectContaining({ updatedFrom: '2024-02-01' }));
  });

  it('exposes updatedFrom in its input schema', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, toolName);
    expect(Object.keys(tool.config.inputSchema as Record<string, unknown>)).toContain('updatedFrom');
  });
});

// Tempo work attributes (e.g. `_Account_`) can be marked required per
// instance, in which case every worklog write without them fails with HTTP
// 400 — so create/update must expose `attributes` and actually forward it.
describe('worklog work attributes', () => {
  const ATTRIBUTES = [{ key: '_Account_', value: '20265520' }];

  function attributesSchemaOf(name: string) {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, name);
    return (tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>).attributes;
  }

  it('tempo_create_worklog sends attributes in the request body', async () => {
    const client = makeClient({ id: '1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_worklog');
    await tool.cb({
      confirm: true,
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
      attributes: ATTRIBUTES,
    });
    expect(client.request).toHaveBeenCalledWith('POST', '/4/worklogs', expect.objectContaining({
      attributes: ATTRIBUTES,
    }));
  });

  it('tempo_update_worklog sends attributes in the request body', async () => {
    const client = makeClient({ id: '5' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_update_worklog');
    await tool.cb({
      confirm: true,
      id: '5',
      authorAccountId: 'abc',
      startDate: '2024-01-15',
      timeSpentSeconds: 7200,
      attributes: ATTRIBUTES,
    });
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/worklogs/5', expect.objectContaining({
      attributes: ATTRIBUTES,
    }));
  });

  it('tempo_create_worklog omits the attributes key entirely when not provided', async () => {
    const client = makeClient({ id: '1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_worklog');
    await tool.cb({
      confirm: true,
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
    });
    const body = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    // Absent, not `[]` — instances without required attributes must keep
    // getting the same body they always did.
    expect(Object.keys(body)).not.toContain('attributes');
  });

  for (const name of ['tempo_create_worklog', 'tempo_update_worklog']) {
    it(`${name} coerces a JSON-stringified attributes array (MCP bridge serialisation) to the native array`, () => {
      // Some MCP client bridges JSON-serialise array arguments, so a
      // well-formed call arrives as a string — it must parse to the same
      // value the native array produces.
      const schema = attributesSchemaOf(name);
      const fromString = schema.safeParse(JSON.stringify(ATTRIBUTES));
      const fromArray = schema.safeParse(ATTRIBUTES);
      expect(fromString.success).toBe(true);
      expect(fromArray.success).toBe(true);
      expect(fromString.data).toEqual(fromArray.data);
    });

    it(`${name} rejects malformed attributes strings with a validation error`, () => {
      const schema = attributesSchemaOf(name);
      // Validation happens in the MCP server layer before the handler runs,
      // so a schema rejection means no network call is ever made.
      expect(schema.safeParse('not json at all').success).toBe(false);
      expect(schema.safeParse('{"key":"_Account_"}').success).toBe(false);
      expect(schema.safeParse([{ value: 'missing key' }]).success).toBe(false);
    });
  }

  it('coerced JSON-string attributes produce a body identical to the native-array case', async () => {
    const client = makeClient({ id: '1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_worklog');
    const schema = (tool.config.inputSchema as Record<string, { parse: (v: unknown) => unknown }>).attributes;
    const args = { confirm: true, authorAccountId: 'abc', issueId: 10001, startDate: '2024-01-15', timeSpentSeconds: 3600 };
    await tool.cb({ ...args, attributes: schema.parse(JSON.stringify(ATTRIBUTES)) });
    await tool.cb({ ...args, attributes: ATTRIBUTES });
    const calls = (client.request as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][2]).toEqual(calls[1][2]);
  });

  it('WORKLOG_OPTIONAL matches the optional fields of tempo_create_worklog (allowlist cannot drift from the schema)', () => {
    // buildOptionalBody silently drops any body field not in the allowlist,
    // so a schema field missing from WORKLOG_OPTIONAL would be accepted from
    // the caller and then never sent — the original attributes bug.
    expect(WORKLOG_OPTIONAL).toContain('attributes');
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_create_worklog');
    const schema = tool.config.inputSchema as Record<string, { isOptional: () => boolean }>;
    const optionalKeys = Object.keys(schema).filter((k) => k !== 'confirm' && schema[k].isOptional());
    expect([...WORKLOG_OPTIONAL].sort()).toEqual(optionalKeys.sort());
  });

  it('tempo_create_worklog dry-run preview surfaces attributes in willSend', async () => {
    const client = makeClient({ id: '1' });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_create_worklog');
    const result = await tool.cb({
      authorAccountId: 'abc',
      issueId: 10001,
      startDate: '2024-01-15',
      timeSpentSeconds: 3600,
      attributes: ATTRIBUTES,
    });
    expect(client.request).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.willSend.attributes).toEqual(ATTRIBUTES);
  });
});

describe('confirm-gate - worklogs', () => {
  it('tempo_delete_worklog without confirm returns dry-run surfacing the bypass flag as a query param and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_worklog');
    const result = await tool.cb({ id: '9', bypassPeriodClosuresAndApprovals: true });
    expect(client.request).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.action).toContain('APPROVED timesheet');
    // bypass is a query param on the real request, so the preview must surface
    // it under willSendQuery, not as a request body (willSend).
    expect(parsed.willSendQuery).toEqual({ bypassPeriodClosuresAndApprovals: true });
    expect(parsed.willSend).toBeUndefined();
  });

  it('tempo_delete_worklog dry-run omits willSend/willSendQuery when bypass is undefined', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_delete_worklog');
    const result = await tool.cb({ id: '9' });
    expect(client.request).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.willSend).toBeUndefined();
    expect(parsed.willSendQuery).toBeUndefined();
  });
});
