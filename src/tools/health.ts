import type { McpServer } from '@modelcontextprotocol/server';
import { ApiError, EdgeBlockedError, readEnvVar } from '@chrischall/mcp-utils';
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

  // A 403 from Tempo itself (not a CDN/WAF edge block, which the helper
  // classifies) means the token was ACCEPTED but lacks the scope the probe
  // reads. Tempo tokens can be issued with custom scopes — e.g. worklogs and
  // approvals only — and such a token serves every tool inside them, so
  // calling it rejected would send someone to replace a working token.
  if (err instanceof ApiError && !(err instanceof EdgeBlockedError) && err.status === 403) {
    return {
      kind: 'insufficient_scope',
      hint:
        'Tempo accepted the token, but it lacks the scope to view accounts, which this check reads (GET /4/accounts). ' +
        'Tools within the token\'s scopes (for example worklogs) still work; if you need account tools, ' +
        'issue a token with that scope in Tempo under Settings → API integration.',
    };
  }
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
