import { describe, it, expect, vi } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { register as registerWorklogs } from '../src/tools/worklogs.js';
import { register as registerPlans } from '../src/tools/plans.js';
import { register as registerTeams } from '../src/tools/teams.js';
import { register as registerAccounts } from '../src/tools/accounts.js';
import { register as registerProjects } from '../src/tools/projects.js';
import { register as registerHealthcheck } from '../src/tools/health.js';
import type { TempoClient } from '../src/client.js';

/**
 * `_meta.mint` hints (the mcp-host context-groups contract), asserted against
 * the SERVED tool list — the timesheet actions register in a loop, so a list
 * kept by hand would miss them.
 */

type Listed = {
  name: string;
  annotations?: { readOnlyHint?: boolean };
  inputSchema: { properties?: Record<string, unknown> };
  _meta?: { mint?: Record<string, any> };
};

const DOMAINS = ['school', 'home', 'work', 'family', 'health', 'money', 'travel', 'food'];
const INTENTS = ['whats-new', 'whats-due', 'whats-on', 'lookup', 'turn-on-off', 'send', 'change', 'other'];
const KEYS = ['domain', 'intent', 'canonical', 'subject', 'when', 'aliases'];
const BRIEF = 'tempo_get_timesheet_approvals_waiting';

function harness(request = vi.fn()) {
  const client = { request } as unknown as TempoClient;
  return createTestHarness((server) => {
    for (const register of [registerWorklogs, registerPlans, registerTeams, registerAccounts, registerProjects]) {
      register(server, client);
    }
    registerHealthcheck(server, client, () => undefined);
  });
}

async function served(): Promise<Listed[]> {
  const h = await harness();
  const { tools } = await h.client.listTools();
  await h.close();
  return tools as Listed[];
}

async function brief(payload: unknown): Promise<string> {
  const h = await harness(vi.fn().mockResolvedValue(payload));
  const result = await h.callTool(BRIEF, { view: 'brief' });
  await h.close();
  return (result.content as Array<{ text: string }>)[0].text;
}

describe('_meta.mint hints', () => {
  it('every tool except the healthcheck carries the work domain and a valid intent', async () => {
    const tools = await served();
    expect(tools.length).toBeGreaterThan(40);
    for (const t of tools) {
      if (t.name.endsWith('_healthcheck')) continue; // registered by mcp-utils, which takes no _meta
      const m = t._meta?.mint;
      expect(m, t.name).toBeDefined();
      expect(Object.keys(m!).every((k) => KEYS.includes(k)), t.name).toBe(true);
      expect(DOMAINS).toContain(m!.domain);
      expect(m!.domain, t.name).toBe('work');
      expect(INTENTS, t.name).toContain(m!.intent);
    }
  });

  it('aliases are everyday words: at most 8, lowercase, at most 40 chars', async () => {
    for (const t of await served()) {
      const aliases = t._meta?.mint?.aliases;
      if (aliases === undefined) continue;
      expect(aliases.length, t.name).toBeLessThanOrEqual(8);
      for (const a of aliases) {
        expect(a.length, t.name).toBeLessThanOrEqual(40);
        expect(a, t.name).toBe(a.toLowerCase());
        expect(a, t.name).not.toMatch(/^tempo_/);
      }
    }
  });

  it('a subject or a when names arguments the tool actually takes', async () => {
    for (const t of await served()) {
      const m = t._meta?.mint;
      const props = t.inputSchema.properties ?? {};
      if (m?.subject) expect(props, t.name).toHaveProperty(m.subject);
      if (m?.when) {
        expect(props, t.name).toHaveProperty(m.when.start);
        expect(props, t.name).toHaveProperty(m.when.end);
      }
    }
  });

  it('canonical only on read-only whats-new/due/on reads, at most one per intent', async () => {
    const tools = await served();
    const canon = tools.filter((t) => t._meta?.mint?.canonical === true);
    const perIntent = new Map<string, number>();
    for (const t of canon) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(['whats-new', 'whats-due', 'whats-on'], t.name).toContain(t._meta!.mint!.intent);
      perIntent.set(t._meta!.mint!.intent, (perIntent.get(t._meta!.mint!.intent) ?? 0) + 1);
    }
    for (const [intent, n] of perIntent) expect(n, intent).toBeLessThanOrEqual(1);
    for (const t of tools) {
      if (t._meta?.mint?.canonical !== undefined) expect(t._meta.mint.canonical, t.name).toBe(true);
    }
  });

  it('the one canonical read is the reviewer queue: timesheets waiting for approval (whats-due)', async () => {
    const canon = (await served()).filter((t) => t._meta?.mint?.canonical === true);
    expect(canon.map((t) => t.name)).toEqual([BRIEF]);
    const m = canon[0]._meta!.mint!;
    expect(m.intent).toBe('whats-due');
    // The queue takes no range and Tempo lists no subjects this server could
    // enumerate at start, so neither is published.
    expect(m.when).toBeUndefined();
    expect(m.subject).toBeUndefined();
  });

  it('every canonical read accepts view: brief', async () => {
    for (const t of (await served()).filter((x) => x._meta?.mint?.canonical === true)) {
      const view = (t.inputSchema.properties ?? {}).view as { enum?: string[] } | undefined;
      expect(view?.enum, t.name).toContain('brief');
    }
  });

  it('writes are changes, never canonical', async () => {
    for (const t of await served()) {
      if (t.name.endsWith('_healthcheck') || t.annotations?.readOnlyHint === true) continue;
      expect(t._meta?.mint?.intent, t.name).toBe('change');
      expect(t._meta?.mint?.canonical, t.name).toBeUndefined();
    }
  });

  it('brief is only offered where it is canonical — the other reads keep compact/full', async () => {
    const tools = await served();
    const view = (t: Listed) => ((t.inputSchema.properties ?? {}).view as { enum?: string[] } | undefined)?.enum;
    expect(view(tools.find((t) => t.name === 'tempo_get_worklogs')!)).toEqual(['compact', 'full']);
  });
});

describe('the brief view of the approval queue', () => {
  const approval = (over: Record<string, unknown> = {}) => ({
    period: { from: '2026-10-26', to: '2026-11-01' },
    requiredSeconds: 144000,
    timeSpentSeconds: 138600,
    user: { accountId: 'acc-1' },
    status: { key: 'IN_REVIEW', comment: 'please approve before Friday', updatedAt: '2026-11-02' },
    ...over,
  });

  it('answers one line per timesheet: title — ISO date — status', async () => {
    const text = await brief({ metadata: { count: 2 }, results: [approval(), approval({ user: { accountId: 'acc-2' }, timeSpentSeconds: 144000 })] });
    expect(text.split('\n')).toEqual([
      'Timesheet acc-1, 2026-10-26 to 2026-11-01 — 2026-11-01 — in review, 38.5h of 40h logged',
      'Timesheet acc-2, 2026-10-26 to 2026-11-01 — 2026-11-01 — in review, 40h of 40h logged',
    ]);
  });

  it('carries no third-party free text (the reviewer comment stays on the full rungs), so lines are bare', async () => {
    const text = await brief({ metadata: { count: 1 }, results: [approval()] });
    expect(text).not.toContain('please approve');
    expect(text.startsWith('{')).toBe(false);
  });

  it('every line is at most 120 chars, even for a long id', async () => {
    const text = await brief({ metadata: { count: 1 }, results: [approval({ user: { accountId: 'x'.repeat(200) } })] });
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(120);
    expect(text).toMatch(/— 2026-11-01 — in review, 38\.5h of 40h logged$/);
  });

  it('flattens control characters so one item is one line', async () => {
    const text = await brief({ metadata: { count: 1 }, results: [approval({ user: { accountId: 'a\nb' } })] });
    expect(text.split('\n')).toHaveLength(1);
  });

  it('says "no date" and "unknown status" when Tempo omits them', async () => {
    const text = await brief({ metadata: { count: 1 }, results: [{ user: { accountId: 'acc-3' } }] });
    expect(text).toBe('Timesheet acc-3 — no date — unknown status');
  });

  it('answers "-- none" for an empty queue', async () => {
    expect(await brief({ metadata: { count: 0 }, results: [] })).toBe('-- none');
    expect(await brief({})).toBe('-- none');
  });

  it('adds a "-- more" note when Tempo reports a further page', async () => {
    const text = await brief({ metadata: { count: 1, next: 'https://api.tempo.io/4/x?offset=1' }, results: [approval()] });
    expect(text.split('\n').at(-1)).toBe('-- more');
  });

  it('the default rung is unchanged (compact, inside the untrusted envelope)', async () => {
    const h = await harness(vi.fn().mockResolvedValue({ metadata: { count: 1 }, results: [approval()] }));
    const result = await h.callTool(BRIEF, {});
    await h.close();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.untrusted_content).toBe(true);
    expect(parsed.results[0].status.comment).toBe('please approve before Friday');
  });
});
