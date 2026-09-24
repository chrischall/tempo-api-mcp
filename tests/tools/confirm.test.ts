import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestHarness, parseToolResult, type TestHarness, type TestHarnessOptions } from '@chrischall/mcp-utils/test';
import { register as registerWorklogs } from '../../src/tools/worklogs.js';
import { register as registerAccounts } from '../../src/tools/accounts.js';
import { register as registerTeams } from '../../src/tools/teams.js';
import { register as registerPlans } from '../../src/tools/plans.js';
import { register as registerProjects } from '../../src/tools/projects.js';
import type { TempoClient } from '../../src/client.js';

// Every mutating Tempo tool is gated by the fleet confirm-token pattern. A
// harness created WITHOUT an elicitation handler is a client that cannot be
// prompted, so under the default MCP_CONFIRM_MODE (ask-user) it gets the
// two-phase token flow: phase 1 returns a preview + confirmToken and writes
// nothing; phase 2 with that token performs the write exactly once.

const ENV_KEYS = ['MCP_CONFIRM_MODE', 'MCP_CONFIRM_TTL_SECONDS', 'MCP_CONFIRM_SECRET'] as const;
let savedEnv: Record<string, string | undefined>;
beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const WORKLOG = {
  tempoWorklogId: 5,
  author: { accountId: 'author-1' },
  issue: { id: 10001 },
  startDate: '2024-01-15',
  startTime: '09:30:00',
  timeSpentSeconds: 3600,
  billableSeconds: 1800,
  description: 'Investigating',
  attributes: { values: [{ key: '_Account_', value: 'ACME' }] },
  updatedAt: '2024-01-15T10:00:00Z',
};
const ACCOUNT = { id: 1, key: 'ACC-1', name: 'Acme', status: 'OPEN', lead: { accountId: 'lead-1' } };
const TEAM = { id: 3, name: 'Platform', summary: 'Core', lead: { accountId: 'lead-1' } };
const PLAN = {
  id: 5,
  assignee: { id: 'user-1', type: 'USER' },
  planItem: { id: '10001', type: 'ISSUE' },
  startDate: '2024-03-01',
  endDate: '2024-03-10',
  effortPersistenceType: 'SECONDS_PER_DAY',
  plannedSecondsPerDay: 3600,
  updatedAt: '2024-02-01T00:00:00Z',
};

function makeClient(overrides: Partial<Record<string, () => unknown>> = {}) {
  const request = vi.fn(async (method: string, path: string) => {
    const key = `${method} ${path}`;
    if (overrides[key]) return overrides[key]!();
    if (key === 'GET /4/worklogs/5') return WORKLOG;
    if (key === 'GET /4/teams/3') return TEAM;
    if (key === 'GET /4/plans/5') return PLAN;
    if (key === 'POST /4/accounts/search') return { results: [ACCOUNT] };
    return { ok: true };
  });
  return { request } as unknown as TempoClient & { request: typeof request };
}

/** Calls that change something upstream — every non-GET except the account lookup. */
function writes(client: ReturnType<typeof makeClient>): unknown[][] {
  return client.request.mock.calls.filter(([m, p]) => m !== 'GET' && p !== '/4/accounts/search');
}

async function harnessFor(client: TempoClient, options?: TestHarnessOptions): Promise<TestHarness> {
  return createTestHarness((server) => {
    registerWorklogs(server, client);
    registerAccounts(server, client);
    registerTeams(server, client);
    registerPlans(server, client);
    registerProjects(server, client);
  }, options);
}

type PhaseOne = {
  status: string;
  confirmToken: string;
  preview: { action: string; method: string; path: string; willSend?: unknown; willSendQuery?: unknown };
};

const GATED: Array<{ tool: string; args: Record<string, unknown>; method: string; path: string }> = [
  { tool: 'tempo_create_worklog', args: { authorAccountId: 'a', issueId: 1, startDate: '2024-01-15', timeSpentSeconds: 3600 }, method: 'POST', path: '/4/worklogs' },
  { tool: 'tempo_update_worklog', args: { id: '5', timeSpentSeconds: 7200 }, method: 'PUT', path: '/4/worklogs/5' },
  { tool: 'tempo_delete_worklog', args: { id: '5', bypassPeriodClosuresAndApprovals: true }, method: 'DELETE', path: '/4/worklogs/5' },
  { tool: 'tempo_create_account', args: { key: 'ACC-2', name: 'New' }, method: 'POST', path: '/4/accounts' },
  { tool: 'tempo_update_account', args: { key: 'ACC-1', name: 'Renamed' }, method: 'PUT', path: '/4/accounts/ACC-1' },
  { tool: 'tempo_delete_account', args: { key: 'ACC-1' }, method: 'DELETE', path: '/4/accounts/ACC-1' },
  { tool: 'tempo_create_team', args: { name: 'New Team' }, method: 'POST', path: '/4/teams' },
  { tool: 'tempo_update_team', args: { id: 3, name: 'Renamed' }, method: 'PUT', path: '/4/teams/3' },
  { tool: 'tempo_delete_team', args: { id: 3 }, method: 'DELETE', path: '/4/teams/3' },
  {
    tool: 'tempo_create_plan',
    args: { assigneeId: 'user-1', assigneeType: 'USER', planItemId: '10001', planItemType: 'ISSUE', startDate: '2024-03-01', endDate: '2024-03-10' },
    method: 'POST',
    path: '/4/plans',
  },
  { tool: 'tempo_update_plan', args: { id: 5, endDate: '2024-03-15' }, method: 'PUT', path: '/4/plans/5' },
  { tool: 'tempo_delete_plan', args: { id: 5 }, method: 'DELETE', path: '/4/plans/5' },
  ...(['submit', 'approve', 'reject', 'reopen', 'recall'] as const).map((action) => ({
    tool: `tempo_${action}_timesheet`,
    args: { accountId: 'user-1', from: '2024-01-01', comment: 'note' },
    method: 'POST',
    path: `/4/timesheet-approvals/user/user-1/${action}`,
  })),
];

describe.each(GATED)('$tool confirm-token gate', ({ tool, args, method, path }) => {
  it('phase 1 returns a preview and a token and writes nothing; phase 2 writes exactly once', async () => {
    const client = makeClient();
    const h = await harnessFor(client);
    try {
      const first = parseToolResult<PhaseOne>(await h.callTool(tool, args));
      expect(first.status).toBe('confirmation-required');
      expect(first.confirmToken).toEqual(expect.any(String));
      expect(first.preview.method).toBe(method);
      expect(first.preview.path).toBe(path);
      expect(first.preview.action).toEqual(expect.any(String));
      expect(writes(client)).toHaveLength(0);

      const second = await h.callTool(tool, { ...args, confirmToken: first.confirmToken });
      expect(second.isError).toBeFalsy();
      expect(writes(client)).toHaveLength(1);
      expect(writes(client)[0][0]).toBe(method);
      expect(writes(client)[0][1]).toBe(path);
    } finally {
      await h.close();
    }
  });

  it('no longer accepts a confirm parameter', async () => {
    const h = await harnessFor(makeClient());
    try {
      const listed = await h.client.listTools();
      const def = listed.tools.find((t) => t.name === tool)!;
      const props = (def.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(props).not.toHaveProperty('confirm');
      expect(props).toHaveProperty('confirmToken');
      expect(def.description).toMatch(/confirmToken/);
      expect(def.description).not.toMatch(/confirm:\s*true/);
    } finally {
      await h.close();
    }
  });
});

describe('confirm-token gate — repo-wide behaviour', () => {
  it('the preview keeps what the old dry-run showed (body and query)', async () => {
    const client = makeClient();
    const h = await harnessFor(client);
    try {
      const del = parseToolResult<PhaseOne>(await h.callTool('tempo_delete_worklog', { id: '5', bypassPeriodClosuresAndApprovals: true }));
      expect(del.preview.action).toContain('APPROVED timesheet');
      expect(del.preview.willSendQuery).toEqual({ bypassPeriodClosuresAndApprovals: true });
      expect(del.preview.willSend).toBeUndefined();

      const upd = parseToolResult<PhaseOne>(await h.callTool('tempo_update_worklog', { id: '5', timeSpentSeconds: 7200 }));
      expect(upd.preview.willSend).toMatchObject({ description: 'Investigating', timeSpentSeconds: 7200 });
    } finally {
      await h.close();
    }
  });

  it('replaying a used token is refused as TOKEN_REUSED and writes nothing more', async () => {
    const client = makeClient();
    const h = await harnessFor(client);
    try {
      const args = { id: 3 };
      const first = parseToolResult<PhaseOne>(await h.callTool('tempo_delete_team', args));
      await h.callTool('tempo_delete_team', { ...args, confirmToken: first.confirmToken });
      expect(writes(client)).toHaveLength(1);
      const replay = await h.callTool('tempo_delete_team', { ...args, confirmToken: first.confirmToken });
      expect(replay.isError).toBe(true);
      expect(parseToolResult<{ error: string }>(replay).error).toBe('TOKEN_REUSED');
      expect(writes(client)).toHaveLength(1);
    } finally {
      await h.close();
    }
  });

  it('changing an argument between the phases is refused as DRAFT_CHANGED and writes nothing', async () => {
    const client = makeClient();
    const h = await harnessFor(client);
    try {
      const first = parseToolResult<PhaseOne>(await h.callTool('tempo_create_team', { name: 'Alpha' }));
      const second = await h.callTool('tempo_create_team', { name: 'Beta', confirmToken: first.confirmToken });
      expect(second.isError).toBe(true);
      expect(parseToolResult<{ error: string }>(second).error).toBe('DRAFT_CHANGED');
      expect(writes(client)).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it('a worklog edited upstream between the phases (new updatedAt) is refused as DRAFT_CHANGED', async () => {
    let reads = 0;
    const client = makeClient({
      'GET /4/worklogs/5': () => ({ ...WORKLOG, updatedAt: reads++ === 0 ? 'v1' : 'v2' }),
    });
    const h = await harnessFor(client);
    try {
      const args = { id: '5', description: 'x' };
      const first = parseToolResult<PhaseOne>(await h.callTool('tempo_update_worklog', args));
      const second = await h.callTool('tempo_update_worklog', { ...args, confirmToken: first.confirmToken });
      expect(second.isError).toBe(true);
      expect(parseToolResult<{ error: string; reason: string }>(second)).toMatchObject({
        error: 'DRAFT_CHANGED',
        reason: 'revision-changed',
      });
      expect(writes(client)).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it('a plan whose current state changed between the phases is refused as DRAFT_CHANGED', async () => {
    let reads = 0;
    const client = makeClient({
      'GET /4/plans/5': () => ({ ...PLAN, description: reads++ === 0 ? 'old' : 'edited elsewhere' }),
    });
    const h = await harnessFor(client);
    try {
      const args = { id: 5, endDate: '2024-03-20' };
      const first = parseToolResult<PhaseOne>(await h.callTool('tempo_update_plan', args));
      const second = await h.callTool('tempo_update_plan', { ...args, confirmToken: first.confirmToken });
      expect(parseToolResult<{ error: string }>(second).error).toBe('DRAFT_CHANGED');
      expect(writes(client)).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it('a client that can be prompted and accepts gets the write', async () => {
    const client = makeClient();
    const elicitation = vi.fn(async () => ({ action: 'accept' as const, content: { confirmed: true } }));
    const h = await harnessFor(client, { elicitation });
    try {
      const result = await h.callTool('tempo_delete_plan', { id: 5 });
      expect(result.isError).toBeFalsy();
      expect(elicitation).toHaveBeenCalledTimes(1);
      expect(writes(client)).toEqual([['DELETE', '/4/plans/5']]);
    } finally {
      await h.close();
    }
  });

  it('a client that can be prompted and declines gets no write', async () => {
    const client = makeClient();
    const h = await harnessFor(client, { elicitation: async () => ({ action: 'decline' as const }) });
    try {
      const result = await h.callTool('tempo_delete_plan', { id: 5 });
      expect(parseToolResult<{ cancelled: boolean }>(result).cancelled).toBe(true);
      expect(writes(client)).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it('MCP_CONFIRM_MODE=refuse refuses on a client that cannot be prompted and writes nothing', async () => {
    process.env.MCP_CONFIRM_MODE = 'refuse';
    const client = makeClient();
    const h = await harnessFor(client);
    try {
      const result = await h.callTool('tempo_create_worklog', GATED[0].args);
      expect(parseToolResult<{ reason: string }>(result).reason).toBe('confirmation-unsupported');
      expect(writes(client)).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it('a token minted for one tool is not accepted by another', async () => {
    const client = makeClient();
    const h = await harnessFor(client);
    try {
      const first = parseToolResult<PhaseOne>(await h.callTool('tempo_delete_team', { id: 3 }));
      const other = await h.callTool('tempo_delete_plan', { id: 3, confirmToken: first.confirmToken });
      expect(other.isError).toBe(true);
      expect(writes(client)).toHaveLength(0);
    } finally {
      await h.close();
    }
  });
});
