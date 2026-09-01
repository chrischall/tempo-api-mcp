import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readEnvVar } from '@chrischall/mcp-utils';
import { registerCredentialHealthcheckTool } from '@chrischall/mcp-utils/healthcheck';
import type { TempoClient } from '../client.js';

/**
 * `tempo_healthcheck` — the one call that answers "is this connector
 * working?", and the only tool here that reports a failure as DATA rather
 * than throwing.
 *
 * Tempo had none. All 43 tools are functional operations, so the closest
 * stand-in was a worklog or account query — and an empty result there reads
 * as "no data in this range" when the real cause is that nothing ever
 * authenticated.
 *
 * The rejection hint names expiry specifically: Tempo API tokens are issued
 * with an explicit expiry date, so a token that worked last month and fails
 * today has a likely answer that "check your credentials" would talk past.
 */

type ReadEnv = (key: string) => string | undefined;

export function classifyTempoError(err: unknown): { kind: string; hint?: string } | undefined {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('invalid or expired')) {
    return {
      kind: 'credential_rejected',
      hint:
        'Tempo rejected the token. Tempo tokens carry an explicit expiry date, so check that first if this ' +
        'worked before — then that the token still has the scopes it needs. ' +
        'Tokens are managed in Tempo under Settings → API integration.',
    };
  }
  return undefined;
}

export function register(
  server: McpServer,
  client: TempoClient,
  /** Seam: injectable so tests need no process env. */
  readEnv: ReadEnv = (k) => readEnvVar(k),
): void {
  registerCredentialHealthcheckTool({
    server,
    prefix: 'tempo',
    hostLabel: 'api.tempo.io',
    probePath: '/4/accounts',
    // `source: null` short-circuits the probe: without a token the request
    // returns a 401 that reads like a rejected token rather than an absent one.
    resolveCredential: async () => ({ source: readEnv('TEMPO_API_TOKEN') ? 'TEMPO_API_TOKEN' : null }),
    // One account, not every worklog: enough to prove the token is accepted,
    // and it writes nothing — no time logged, no plan changed.
    probeFn: () => client.request('GET', '/4/accounts', undefined, { limit: 1 }),
    classifyThrown: classifyTempoError,
  });
}
