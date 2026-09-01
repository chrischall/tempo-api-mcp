import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { register } from '../../src/tools/health.js';
import type { TempoClient } from '../../src/client.js';

type ToolEntry = { name: string; config: Record<string, unknown>; cb: Function };

/** Look a tool up by name, as the other tests/tools/*.test.ts files do. */
function findTool(tools: ToolEntry[], name: string): ToolEntry {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

/** The mock server every tests/tools/*.test.ts file in this repo uses. */
function makeMockServer(): { server: McpServer; tools: ToolEntry[] } {
  const tools: ToolEntry[] = [];
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, cb: Function) => {
      tools.push({ name, config, cb });
    }),
  } as unknown as McpServer;
  return { server, tools };
}

function setup(env: Record<string, string | undefined>, probe?: () => Promise<unknown>) {
  const request = vi.fn(probe ?? (async () => ({ results: [] })));
  const client = { request } as unknown as TempoClient;
  const { server, tools } = makeMockServer();
  register(server, client, (k: string) => env[k]);
  const call = async () =>
    JSON.parse((await findTool(tools, 'tempo_healthcheck').cb({}, {})).content[0].text);
  return { tools, call, request };
}

const FULL = { TEMPO_API_TOKEN: 'TKN' };

describe('tempo_healthcheck', () => {
  it('registers under the repo tool prefix', () => {
    expect(setup(FULL).tools.map((t) => t.name)).toEqual(['tempo_healthcheck']);
  });

  it('reports ok when the token resolves and the probe succeeds', async () => {
    const out = await setup(FULL).call();
    expect(out.ok).toBe(true);
    expect(out.credential.resolved).toBe(true);
  });

  it('probes a single account rather than every worklog', async () => {
    const { call, request } = setup(FULL);
    await call();
    expect(request).toHaveBeenCalledWith('GET', '/4/accounts', undefined, { limit: 1 });
  });

  it('names the token env var as the source without echoing it', async () => {
    const out = await setup({ TEMPO_API_TOKEN: 'SUPER-SECRET' }).call();
    expect(out.credential.source).toBe('TEMPO_API_TOKEN');
    expect(JSON.stringify(out)).not.toContain('SUPER-SECRET');
  });

  it('reports a missing token as no_credential and skips the probe', async () => {
    const { call, request } = setup({});
    const out = await call();
    expect(out.ok).toBe(false);
    expect(out.error.kind).toBe('no_credential');
    expect(request).not.toHaveBeenCalled();
  });

  // Tempo tokens are issued with an explicit expiry date, so "invalid or
  // expired" has a likely answer that generic advice would miss.
  it('reports a rejected token as credential_rejected and mentions expiry', async () => {
    const out = await setup(FULL, async () => { throw new Error('TEMPO_API_TOKEN is invalid or expired'); }).call();
    expect(out.error.kind).toBe('credential_rejected');
    expect(out.hint).toMatch(/expir/i);
  });

  it('leaves an unrecognised failure to the helper defaults', async () => {
    const out = await setup(FULL, async () => { throw new Error('socket hang up'); }).call();
    expect(out.ok).toBe(false);
    expect(out.error.kind).not.toBe('credential_rejected');
  });

  it('classifies a non-Error throw without crashing', async () => {
    const out = await setup(FULL, async () => { throw 'TEMPO_API_TOKEN is invalid or expired'; }).call();
    expect(out.error.kind).toBe('credential_rejected');
  });

  it('reads the real environment when no reader is injected', async () => {
    vi.stubEnv('TEMPO_API_TOKEN', 'REAL-TKN');
    const { server, tools } = makeMockServer();
    register(server, { request: vi.fn(async () => ({})) } as any);
    const out = JSON.parse((await findTool(tools, 'tempo_healthcheck').cb({}, {})).content[0].text);
    expect(out.credential.resolved).toBe(true);
    expect(JSON.stringify(out)).not.toContain('REAL-TKN');
    vi.unstubAllEnvs();
  });
});
