import { describe, it, expect, vi } from 'vitest';
import { handleTool, toolDefinitions } from '../../src/tools/accounts.js';
import type { TempoClient } from '../../src/client.js';

function makeClient(returnValue: unknown = {}): TempoClient {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as TempoClient;
}

describe('account toolDefinitions', () => {
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

describe('handleTool - accounts', () => {
  it('tempo_get_accounts calls GET /4/accounts', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_accounts', { limit: 20 }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/accounts', undefined, expect.objectContaining({ limit: 20 }));
  });

  it('tempo_get_account calls GET /4/accounts/:key', async () => {
    const client = makeClient({ key: 'ACCT-1' });
    await handleTool('tempo_get_account', { key: 'ACCT-1' }, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/accounts/ACCT-1');
  });

  it('tempo_search_accounts calls POST /4/accounts/search', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_search_accounts', { statusList: ['OPEN'], query: 'test' }, client);
    expect(client.request).toHaveBeenCalledWith('POST', '/4/accounts/search',
      expect.objectContaining({ statusList: ['OPEN'], query: 'test' }),
      expect.anything()
    );
  });

  it('tempo_create_account calls POST /4/accounts', async () => {
    const client = makeClient({ key: 'NEW-1' });
    await handleTool('tempo_create_account', { key: 'NEW-1', name: 'New Account', status: 'OPEN' }, client);
    expect(client.request).toHaveBeenCalledWith('POST', '/4/accounts', expect.objectContaining({
      key: 'NEW-1',
      name: 'New Account',
      status: 'OPEN',
    }));
  });

  it('tempo_update_account calls PUT /4/accounts/:key', async () => {
    const client = makeClient({ key: 'ACCT-2' });
    await handleTool('tempo_update_account', { key: 'ACCT-2', name: 'Updated Account' }, client);
    expect(client.request).toHaveBeenCalledWith('PUT', '/4/accounts/ACCT-2', expect.objectContaining({
      key: 'ACCT-2',
      name: 'Updated Account',
    }));
  });

  it('tempo_delete_account calls DELETE /4/accounts/:key', async () => {
    const client = makeClient(undefined);
    const result = await handleTool('tempo_delete_account', { key: 'ACCT-3' }, client);
    expect(client.request).toHaveBeenCalledWith('DELETE', '/4/accounts/ACCT-3');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  it('tempo_get_account_categories calls GET /4/account-categories', async () => {
    const client = makeClient({ results: [] });
    await handleTool('tempo_get_account_categories', {}, client);
    expect(client.request).toHaveBeenCalledWith('GET', '/4/account-categories', undefined, expect.anything());
  });

  it('throws for unknown tool name', async () => {
    const client = makeClient();
    await expect(handleTool('unknown_tool', {}, client)).rejects.toThrow('Unknown tool: unknown_tool');
  });
});
