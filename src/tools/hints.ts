/**
 * Context-group hints, published on each tool as `_meta.mint` (mcp-host's
 * `mintHintSchema`, context-groups spec 2026-11-03 D4). Inert data: a client
 * that does not read them sees an extra `_meta` key and nothing else. The
 * shape is fixed by the host's contract, so it is restated here rather than
 * imported — this server takes no dependency on mcp-host.
 *
 * Every tool here is in the `work` group. Only ONE read answers a
 * what's-new/due/on question: the reviewer's queue of timesheets waiting for
 * approval (`whats-due`). Worklogs are a record rather than news, plans are
 * organisation-wide allocations keyed by opaque issue ids, and the API token
 * names no "me" to narrow either to — so those are lookups. Nothing here can
 * LIST a person's subjects at start, so no hint names a `subject`.
 */
export type MintIntent =
  | 'whats-new' | 'whats-due' | 'whats-on' | 'lookup' | 'turn-on-off' | 'send' | 'change' | 'other';

export interface MintHint {
  domain: 'work';
  intent: MintIntent;
  canonical?: true;
  subject?: string;
  when?: { start: string; end: string };
  aliases?: string[];
}

/** `_meta` for a Tempo tool. */
export function workMeta(intent: MintIntent, extra: Omit<MintHint, 'domain' | 'intent'> = {}): { mint: MintHint } {
  return { mint: { domain: 'work', intent, ...extra } };
}

/** What people call logged time. Lowercase, ≤ 8, each ≤ 40 chars. */
export const TIME_ALIASES = ['timesheet', 'hours', 'log time', 'time tracking', 'worklog'];
/** What a reviewer calls the approval queue. */
export const APPROVAL_ALIASES = ['timesheet approvals', 'approve timesheets', 'pending timesheets', 'timesheets to review'];

/** A read that answers a question about one thing, never a feed. */
export const LOOKUP = workMeta('lookup');
/** A read of logged time. */
export const TIME_LOOKUP = workMeta('lookup', { aliases: TIME_ALIASES });
/** A write: create, update, delete, or a timesheet state transition. */
export const CHANGE = workMeta('change');
/** A write to logged time. */
export const TIME_CHANGE = workMeta('change', { aliases: TIME_ALIASES });
