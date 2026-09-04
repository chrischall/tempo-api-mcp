import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { viewResponse, TEMPO_VIEWS } from '../src/view.js';
import { register as registerPlans } from '../src/tools/plans.js';
import type { TempoClient } from '../src/client.js';

const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

describe('the rungs', () => {
  it('offers compact and full, and not raw — full already IS the upstream payload', () => {
    expect(TEMPO_VIEWS).toEqual(['compact', 'full']);
  });

  it('defaults to compact when no view is given', () => {
    const data = { id: 1, photo: 'https://cdn/x.png' };
    expect(parse(viewResponse(undefined, data))).toEqual({ id: 1 });
  });
});

describe('what compact does — and what it deliberately does not', () => {
  it('strips image and avatar URLs', () => {
    const data = { users: [{ id: 7, name: 'A', avatar: 'https://cdn/a.png', photoUrl: 'https://cdn/b.jpg' }] };
    expect(parse(viewResponse('compact', data))).toEqual({ users: [{ id: 7, name: 'A' }] });
  });

  it('keeps EVERY other field, because nothing here knows which Tempo fields matter', () => {
    // The honest ceiling for this repo: no schema, no fixture, no documented
    // shape, no live tenant. A field list invented here could drop something a
    // caller needs, and the record would come back with holes in it looking
    // like a verified answer.
    const record = {
      id: 5, name: 'Team 5', leadAccountId: 'abc', programId: 2,
      summary: '', metadata: { self: 'https://api.tempo.io/4/teams/5' }, archivedAt: null,
      somethingNobodyAnticipated: 'kept',
    };
    expect(parse(viewResponse('compact', { data: [record] }))).toEqual({ data: [record] });
  });

  it('keeps null — an absent key and a null one are different facts', () => {
    expect(parse(viewResponse('compact', { endedAt: null }))).toEqual({ endedAt: null });
  });

  it('keeps a page URL', () => {
    const d = { link: 'https://api.tempo.io/4/worklogs/9' };
    expect(parse(viewResponse('compact', d))).toEqual(d);
  });
});

describe('full', () => {
  it('returns the payload untouched, images included', () => {
    const data = { id: 1, photo: 'https://cdn/x.png' };
    expect(parse(viewResponse('full', data))).toEqual(data);
  });
});

describe('whitespace', () => {
  it('emits none of its own, and never touches whitespace inside a value', () => {
    const description = 'Line one.\n\n  Indented.   ';
    const text = viewResponse('compact', { description }).content[0].text;
    expect(text.split('\n')).toHaveLength(1);
    expect(JSON.parse(text).description).toBe(description);
  });
});

describe('`view` never reaches the Tempo API', () => {
  /**
   * `tempo_get_plans` forwarded its whole args object as the query string for
   * `GET /4/plans`, so adding a `view` parameter to its schema started sending
   * `view=compact` upstream on every call. Flagged across three review rounds
   * before it was fixed — the earlier rounds were right each time.
   *
   * Exercised through the handler against a mocked client, the way every test
   * in tests/tools/ does, rather than by matching the handler's SOURCE TEXT:
   * a regex over plans.ts goes green for a rewrite that still leaks and red
   * for a harmless refactor that doesn't — it pins the spelling, not the
   * behaviour, and the behaviour is the whole finding.
   */
  it('is not in the query string tempo_get_plans sends', async () => {
    const request = vi.fn().mockResolvedValue({ results: [] });
    const tools: { name: string; cb: (args: Record<string, unknown>) => Promise<unknown> }[] = [];
    const server = {
      registerTool: (
        name: string,
        _config: unknown,
        cb: (args: Record<string, unknown>) => Promise<unknown>,
      ) => {
        tools.push({ name, cb });
      },
    } as unknown as McpServer;

    registerPlans(server, { request } as unknown as TempoClient);
    const getPlans = tools.find(t => t.name === 'tempo_get_plans');
    if (!getPlans) throw new Error('tempo_get_plans was not registered');

    await getPlans.cb({ view: 'full', from: '2024-01-01', to: '2024-01-31' });

    expect(request).toHaveBeenCalledTimes(1);
    const query = request.mock.calls[0][3] as Record<string, unknown>;
    expect(query).not.toHaveProperty('view');
    expect(query).toEqual({ from: '2024-01-01', to: '2024-01-31' });
  });

  it('still reaches viewResponse — the destructure drops it from the query, not from the answer', async () => {
    const request = vi.fn().mockResolvedValue({ id: 1, photo: 'https://cdn/x.png' });
    const tools: { name: string; cb: (args: Record<string, unknown>) => Promise<unknown> }[] = [];
    const server = {
      registerTool: (
        name: string,
        _config: unknown,
        cb: (args: Record<string, unknown>) => Promise<unknown>,
      ) => {
        tools.push({ name, cb });
      },
    } as unknown as McpServer;

    registerPlans(server, { request } as unknown as TempoClient);
    const getPlans = tools.find(t => t.name === 'tempo_get_plans');
    if (!getPlans) throw new Error('tempo_get_plans was not registered');

    const full = await getPlans.cb({ view: 'full', from: '2024-01-01', to: '2024-01-31' });
    expect(parse(full as { content: { text: string }[] })).toEqual({ id: 1, photo: 'https://cdn/x.png' });

    const compact = await getPlans.cb({ from: '2024-01-01', to: '2024-01-31' });
    expect(parse(compact as { content: { text: string }[] })).toEqual({ id: 1 });
  });
});
