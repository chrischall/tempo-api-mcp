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
  it('registers 15 tools', () => {
    const { server, tools } = makeMockServer();
    const client = makeClient();
    register(server, client);
    expect(tools.length).toBe(15);
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

  // Upstream declares `from` required on GET /4/timesheet-approvals/user/{accountId}
  // (and both `from` and `to` on GET /4/periods). Marking them optional let a
  // call through that the API rejects with a 400 — catch it in the schema instead.
  it('tempo_get_timesheet_approval_status requires from and leaves to optional', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_get_timesheet_approval_status');
    const schema = tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(schema.from.safeParse(undefined).success).toBe(false);
    expect(schema.from.safeParse('2024-01-01').success).toBe(true);
    expect(schema.to.safeParse(undefined).success).toBe(true);
  });

  it('tempo_get_periods requires both from and to', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_get_periods');
    const schema = tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(schema.from.safeParse(undefined).success).toBe(false);
    expect(schema.to.safeParse(undefined).success).toBe(false);
    expect(schema.from.safeParse('2024-01-01').success).toBe(true);
    expect(schema.to.safeParse('2024-12-31').success).toBe(true);
  });

  it('tempo_get_timesheet_approvals_waiting calls GET /4/timesheet-approvals/waiting with no params', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_timesheet_approvals_waiting');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/timesheet-approvals/waiting');
  });

  it('tempo_search_timesheet_approval_logs sends userAccountIds/updatedFrom body and token pagination', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_search_timesheet_approval_logs');
    await tool.cb({
      userAccountIds: ['user1'],
      updatedFrom: '2024-01-01',
      nextPageToken: 'tok123',
      limit: 25,
    });
    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/4/timesheet-approvals/logs/search',
      expect.objectContaining({ userAccountIds: ['user1'], updatedFrom: '2024-01-01' }),
      expect.objectContaining({ nextPageToken: 'tok123', limit: 25 })
    );
  });

  it('tempo_search_timesheet_approval_logs no longer exposes unsupported filters', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_search_timesheet_approval_logs');
    const keys = Object.keys(tool.config.inputSchema as Record<string, unknown>);
    expect(keys).not.toContain('accountIds');
    expect(keys).not.toContain('reviewerIds');
    expect(keys).not.toContain('from');
    expect(keys).not.toContain('to');
    expect(keys).not.toContain('offset');
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

  it('tempo_get_user_schedule calls GET /4/user-schedule/:accountId', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_user_schedule');
    await tool.cb({
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-07',
    });
    expect(client.request).toHaveBeenCalledWith('GET', '/4/user-schedule/user123', undefined, {
      from: '2024-01-01',
      to: '2024-01-07',
    });
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

  it('tempo_get_roles calls GET /4/roles with no params', async () => {
    const client = makeClient({ results: [] });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, 'tempo_get_roles');
    await tool.cb({});
    expect(client.request).toHaveBeenCalledWith('GET', '/4/roles');
  });
});

// POST /4/timesheet-approvals/user/{accountId}/{action} — five state transitions
// sharing one shape: required `from` (+ optional `to`) as query params, an
// optional {comment, reviewerAccountId} body, and a confirm gate.
const TIMESHEET_ACTION_TOOLS = [
  ['tempo_submit_timesheet', 'submit'],
  ['tempo_approve_timesheet', 'approve'],
  ['tempo_reject_timesheet', 'reject'],
  ['tempo_reopen_timesheet', 'reopen'],
  ['tempo_recall_timesheet', 'recall'],
] as const;

describe.each(TIMESHEET_ACTION_TOOLS)('%s', (toolName, action) => {
  it(`calls POST /4/timesheet-approvals/user/:accountId/${action} when confirmed`, async () => {
    const client = makeClient({ status: { key: 'APPROVED' } });
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, toolName);
    await tool.cb({
      confirm: true,
      accountId: 'user123',
      from: '2024-01-01',
      to: '2024-01-31',
      comment: 'looks good',
      reviewerAccountId: 'reviewer456',
    });
    expect(client.request).toHaveBeenCalledWith(
      'POST',
      `/4/timesheet-approvals/user/user123/${action}`,
      { comment: 'looks good', reviewerAccountId: 'reviewer456' },
      { from: '2024-01-01', to: '2024-01-31' }
    );
  });

  it('omits the body entirely when neither comment nor reviewerAccountId is given', async () => {
    const client = makeClient({});
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, toolName);
    await tool.cb({ confirm: true, accountId: 'user123', from: '2024-01-01' });
    expect(client.request).toHaveBeenCalledWith(
      'POST',
      `/4/timesheet-approvals/user/user123/${action}`,
      undefined,
      { from: '2024-01-01', to: undefined }
    );
  });

  it('without confirm returns a dry-run preview and makes NO request', async () => {
    const client = makeClient(undefined);
    const { server, tools } = makeMockServer();
    register(server, client);
    const tool = findTool(tools, toolName);
    const result = await tool.cb({ accountId: 'user123', from: '2024-01-01', comment: 'hi' });
    expect(client.request).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.method).toBe('POST');
    expect(parsed.path).toBe(`/4/timesheet-approvals/user/user123/${action}`);
    expect(parsed.willSend).toEqual({ comment: 'hi' });
    // `to` is undefined here, so the preview must not advertise it.
    expect(parsed.willSendQuery).toEqual({ from: '2024-01-01' });
  });

  it('is marked as a mutating tool', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, toolName);
    expect((tool.config.annotations as { readOnlyHint: boolean }).readOnlyHint).toBe(false);
  });

  it('rejects account ids containing slashes or traversal sequences', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, toolName);
    const schema = tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(schema.accountId.safeParse('123456:0123-4567').success).toBe(true);
    expect(schema.accountId.safeParse('../../roles').success).toBe(false);
    expect(schema.accountId.safeParse('user/submit').success).toBe(false);
    // `from` gates the period the action applies to — a malformed date must not
    // reach the API as an unbounded range.
    expect(schema.from.safeParse('2024-01-01').success).toBe(true);
    expect(schema.from.safeParse('01/01/2024').success).toBe(false);
  });
});

describe('project id path-traversal hardening', () => {
  // Project ids are interpolated into request paths (/4/projects/${id}), so
  // the input schema must reject path separators and traversal sequences —
  // the same defence-in-depth already applied to AccountId.
  it('tempo_get_project rejects ids containing slashes or traversal sequences', () => {
    const { server, tools } = makeMockServer();
    register(server, makeClient());
    const tool = findTool(tools, 'tempo_get_project');
    const id = (tool.config.inputSchema as Record<string, { safeParse: (v: unknown) => { success: boolean } }>).id;
    expect(id.safeParse('301').success).toBe(true);
    expect(id.safeParse('../roles').success).toBe(false);
    expect(id.safeParse('1/sub').success).toBe(false);
    expect(id.safeParse('1?x=y').success).toBe(false);
    expect(id.safeParse('1#frag').success).toBe(false);
  });
});
