import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TempoClient } from '../src/client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('TempoClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TEMPO_API_TOKEN: 'test-token' };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when TEMPO_API_TOKEN is missing', () => {
    delete process.env.TEMPO_API_TOKEN;
    expect(() => new TempoClient()).toThrow('TEMPO_API_TOKEN environment variable is required');
  });

  it('makes authenticated GET requests', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    const client = new TempoClient();
    const result = await client.request<{ results: unknown[] }>('GET', '/4/worklogs');
    expect(result).toEqual({ results: [] });
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tempo.io/4/worklogs');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  it('builds query string from params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const client = new TempoClient();
    await client.request('GET', '/4/worklogs', undefined, { from: '2024-01-01', limit: 10 });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('from=2024-01-01');
    expect(url).toContain('limit=10');
  });

  it('handles array query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const client = new TempoClient();
    await client.request('GET', '/4/worklogs', undefined, { projectId: [1, 2, 3] });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('projectId=1');
    expect(url).toContain('projectId=2');
    expect(url).toContain('projectId=3');
  });

  it('skips null/undefined query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const client = new TempoClient();
    await client.request('GET', '/4/worklogs', undefined, { from: undefined, to: null as unknown as undefined });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tempo.io/4/worklogs');
  });

  it('sends POST body as JSON', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1' }));
    const client = new TempoClient();
    const body = { authorAccountId: 'abc', issueId: 10001, startDate: '2024-01-01', timeSpentSeconds: 3600 };
    await client.request('POST', '/4/worklogs', body);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual(body);
  });

  it('throws on 401 unauthorized', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const client = new TempoClient();
    await expect(client.request('GET', '/4/worklogs')).rejects.toThrow('TEMPO_API_TOKEN is invalid or expired');
  });

  it('retries once on 429 rate limit', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    const client = new TempoClient();
    const promise = client.request('GET', '/4/worklogs');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ results: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throws on repeated 429 rate limit', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }));
    const client = new TempoClient();
    const assertion = expect(client.request('GET', '/4/worklogs')).rejects.toThrow('Rate limited by Tempo API');
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new TempoClient();
    const result = await client.request('DELETE', '/4/worklogs/1');
    expect(result).toBeUndefined();
  });

  it('throws on non-ok responses with error body', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Worklog not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const client = new TempoClient();
    await expect(client.request('GET', '/4/worklogs/999')).rejects.toThrow('Worklog not found');
  });
});
