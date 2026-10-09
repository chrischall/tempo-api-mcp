import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/server';
import { register as registerWorklogs } from '../src/tools/worklogs.js';
import { register as registerPlans } from '../src/tools/plans.js';
import { register as registerTeams } from '../src/tools/teams.js';
import { register as registerAccounts } from '../src/tools/accounts.js';
import { register as registerProjects } from '../src/tools/projects.js';
import { register as registerHealthcheck } from '../src/tools/health.js';
import type { TempoClient } from '../src/client.js';

/**
 * Every tool declares what it is, read off the REGISTERED config rather than
 * a hand-kept list (timesheet actions register in a loop, which no
 * `registerTool('<literal>'` scan sees).
 *
 * `destructiveHint` defaults to TRUE whenever readOnlyHint is false, so a
 * write that forgets it publishes as destructive and nothing fails — a
 * considered `false` and a forgotten one look identical. The invariant worth
 * pinning is that each write CHOOSES, by the inverse test: a write is
 * additive only when a later call in this same tool set restores the prior
 * state, and anything that reaches another person has no inverse.
 */

interface Ann {
  readOnlyHint?: unknown;
  destructiveHint?: unknown;
  openWorldHint?: unknown;
}

function registeredAnnotations(): Record<string, Ann | undefined> {
  const seen: Record<string, Ann | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Ann }) => {
      seen[name] = cfg.annotations;
    },
  } as unknown as McpServer;
  const client = { request: vi.fn() } as unknown as TempoClient;
  for (const register of [registerWorklogs, registerPlans, registerTeams, registerAccounts, registerProjects]) {
    register(server, client);
  }
  registerHealthcheck(server, client, () => undefined);
  return seen;
}

// Each has a later call here that undoes it: create ↔ delete, and an update
// is undone by another update carrying the prior values (the merged update
// previews the current record before anything is confirmed). Known limit:
// the merged update only SETS fields — an omitted field carries forward and
// none can be cleared — so an update that fills a previously-empty field
// (a team's lead, an account's budget, a plan's description) cannot be taken
// back to empty. Accepted, as fleet-wide for merged updates: the record
// itself is never lost and every prior value that existed can be restored.
const ADDITIVE = [
  'tempo_create_plan',
  'tempo_update_plan',
  'tempo_create_team',
  'tempo_update_team',
  'tempo_create_account',
  'tempo_update_account',
];

// Deletions have no inverse (a re-create mints a new id), and every timesheet
// approval action moves the timesheet between the owner and their reviewer —
// it reaches another person, so it cannot be taken back. Worklog create and
// update accept remainingEstimateSeconds, which overwrites the Jira ISSUE's
// remaining estimate (not part of the worklog); no tool here reads that
// estimate, so neither deleting the worklog nor re-updating it restores it.
const DESTRUCTIVE = [
  'tempo_create_worklog',
  'tempo_update_worklog',
  'tempo_delete_worklog',
  'tempo_delete_plan',
  'tempo_delete_team',
  'tempo_delete_account',
  'tempo_submit_timesheet',
  'tempo_approve_timesheet',
  'tempo_reject_timesheet',
  'tempo_reopen_timesheet',
  'tempo_recall_timesheet',
];

describe('tool annotations', () => {
  it('registers the full surface (guards against a registrar being dropped here)', () => {
    expect(Object.keys(registeredAnnotations())).toHaveLength(48);
  });

  it('sets an explicit boolean readOnlyHint on every tool', () => {
    const missing = Object.entries(registeredAnnotations())
      .filter(([, a]) => typeof a?.readOnlyHint !== 'boolean')
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('sets an explicit boolean destructiveHint on every write', () => {
    const undeclared = Object.entries(registeredAnnotations())
      .filter(([, a]) => a?.readOnlyHint === false && typeof a?.destructiveHint !== 'boolean')
      .map(([name]) => name);
    expect(undeclared).toEqual([]);
  });

  it('never lets a read claim to be destructive', () => {
    const contradictory = Object.entries(registeredAnnotations())
      .filter(([, a]) => a?.readOnlyHint === true && a?.destructiveHint === true)
      .map(([name]) => name);
    expect(contradictory).toEqual([]);
  });

  it('marks every tool open-world (each one calls api.tempo.io)', () => {
    const local = Object.entries(registeredAnnotations())
      .filter(([, a]) => a?.openWorldHint !== true)
      .map(([name]) => name);
    expect(local).toEqual([]);
  });

  it('classifies each write by the inverse test', () => {
    const ann = registeredAnnotations();
    const writes = Object.entries(ann).filter(([, a]) => a?.readOnlyHint === false);
    const additive = writes.filter(([, a]) => a?.destructiveHint === false).map(([n]) => n);
    const destructive = writes.filter(([, a]) => a?.destructiveHint === true).map(([n]) => n);
    expect(additive.sort()).toEqual([...ADDITIVE].sort());
    expect(destructive.sort()).toEqual([...DESTRUCTIVE].sort());
  });
});
