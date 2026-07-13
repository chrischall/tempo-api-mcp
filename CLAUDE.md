# tempo-api-mcp

MCP server exposing the Tempo REST API (v4) to Claude via stdio transport. Forty-odd tools for worklogs, plans, teams, accounts, projects, timesheet approvals, periods, schedules, and Tempo configuration.

## Commands

```bash
npm run build          # tsc + esbuild bundle → dist/index.js + dist/bundle.js
npm test               # vitest run
npm run test:watch     # vitest watch
npm run test:coverage  # v8 coverage (text + html)
```

Run locally (requires built dist):
```bash
TEMPO_API_TOKEN=xxx npm run dev   # node dist/index.js
```

## Tool naming

All tools are prefixed `tempo_` (e.g. `tempo_get_worklogs`, `tempo_create_worklog`, `tempo_get_timesheet_approval_status`).

## Architecture

```
src/
  index.ts          # entry — `runMcp({ name, version, deps: client, tools: [...] })` from @chrischall/mcp-utils
  client.ts         # TempoClient — thin wrapper over `createApiClient` (mcp-utils); Bearer auth, retry, timeout
  tools/
    worklogs.ts     # worklogs CRUD + search + by-user/project/issue/team/account
    plans.ts        # plans CRUD (resource allocations)
    teams.ts        # teams CRUD + team-memberships list/search
    accounts.ts     # accounts CRUD + search + categories
    projects.ts     # projects, timesheet approvals/logs, periods, user-schedule, global config, work attributes, roles
```

Each tool file exports `register(server: McpServer, client: TempoClient)` and calls `server.registerTool(name, def, handler)` for each tool. To add a new domain, create `src/tools/<name>.ts` with a `register` export and add it to the `tools` array in `src/index.ts`.

Most plumbing lives in **`@chrischall/mcp-utils`**, not this repo: `runMcp` (boots the high-level `McpServer` + stdio transport, prints the AI-maintained banner to stderr), `createApiClient`/`fetchJson` (Bearer auth, retry, timeout, auth/rate-limit error mapping), `loadDotenvSafely`, `readEnvVar` (placeholder-defended env parsing), `buildOptionalBody` (body builders), and `textResult`/`rawTextResult` (tool output). `TempoClient` (`client.ts`) just configures `createApiClient` for Tempo; the tool modules still receive the SDK's high-level `McpServer`.

## Environment

```
TEMPO_API_TOKEN=   # required — Bearer token from Tempo → Settings → API integration
```

Loaded from `.env` at the repo root via `loadDotenvSafely` (mcp-utils; silent if dotenv is unavailable, e.g. inside the mcpb bundle). `TempoClient`'s constructor **defers** the missing-token error rather than throwing — so the server still boots and answers the host's install-time smoke test with no token configured; the error is re-raised at the first tool call. `readEnvVar` treats blank/unsubstituted (`${FOO}` literal) values as missing, defending against MCP hosts that pass `.mcp.json` env blocks through unexpanded.

## Testing

Tests live in `tests/` — `client.test.ts`, one file per tool module under `tests/tools/`, and `version-sync.test.ts`. Run with `npm test`. No real API calls — `client.test.ts` stubs global `fetch` (`vi.stubGlobal`); the tool tests mock `TempoClient.request`. `tests/version-sync.test.ts` uses the shared `versionSyncTest` helper from `@chrischall/mcp-utils/test` to assert every `// x-release-please-version` marker in `src/` matches `package.json` (guards against release-please skipping a marker). `vitest.config.ts` enables v8 coverage but does **not** enforce thresholds.

## Plugin / Marketplace

```
.claude-plugin/
  plugin.json       # Claude Code plugin manifest (MCP server config via npx)
  marketplace.json  # Marketplace catalog entry
manifest.json       # Anthropic MCPB manifest (used by `npx @anthropic-ai/mcpb pack`)
server.json         # modelcontextprotocol/registry submission
skills/tempo-api-mcp/
  SKILL.md          # Claude Code skill — teaches Claude when/how to use the tools
.mcp.json           # Local dev convenience: points Claude at `node dist/index.js`
```

## Publishing constraints

The MCP Registry's [server.schema.json](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json) caps `server.json`'s `description` at **100 characters**. Values over that fail `mcp-publisher publish` with HTTP 422 (`validation failed: expected length <= 100, location: body.description`). The other description fields (`manifest.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`) have no published length constraint and can stay longer.

Sanity-check before committing a description change:

```bash
jq -r '.description | length' server.json
```

## Versioning

Version appears in SIX places — all must match:

1. `package.json` → `"version"`
2. `package-lock.json` → `npm install --package-lock-only` after bumping (or `npm version` does it)
3. `src/index.ts` → the `version` passed to `runMcp(...)`, tagged `// x-release-please-version` (release-please bumps the marker; `tests/version-sync.test.ts` fails if it drifts from `package.json`)
4. `manifest.json` → `"version"`
5. `server.json` → `"version"` and every `packages[].version`
6. `.claude-plugin/plugin.json` → `"version"`, and `.claude-plugin/marketplace.json` → `metadata.version` + every `plugins[].version`

### Important

Do NOT manually bump versions or create tags unless the user explicitly asks. Versioning is handled by **release-please** (`.github/workflows/release-please.yml`). `release-please-config.json` registers all of the files above as `extra-files`, so a single release PR bumps them in lockstep.

### Release workflow

Commits land on `main` via PR. release-please (`.github/workflows/release-please.yml`) opens or updates a `chore(main): release X.Y.Z` PR whenever Conventional-Commit messages (`feat:`, `fix:`, etc.) accumulate. Merging the release PR (arm `ready-to-merge`) creates the tag and a GitHub Release. The `publish` job in the same workflow then:

- Rebuilds, packages a `skills/tempo-api-mcp/SKILL.md`-only `.skill` zip, and `npx @anthropic-ai/mcpb pack` → `.mcpb` bundle
- `npm publish --access public --provenance`
- Publishes to the MCP Registry via `mcp-publisher` (GitHub OIDC)
- Conditionally publishes the skill to ClawHub (skipped if `CLAWHUB_TOKEN` is not set)
- Attaches `.skill` and `.mcpb` to the GitHub Release

<!-- pr-workflow:v2 -->
## Pull requests & release notes

**Default workflow: branch + PR, even for solo work.** Direct pushes to `main` skip review *and* skip auto-generated release notes — GitHub's `generate_release_notes` (configured in `.github/release.yml`) only picks up merged PRs. Push directly to `main` only when the user explicitly asks for it (e.g. emergency hotfix).

For every PR, apply exactly one label so it lands in the right release-notes section:

| Label                | Section in release notes |
|----------------------|--------------------------|
| `enhancement`        | Features                 |
| `bug`                | Bug Fixes                |
| `security`           | Security                 |
| `refactor`           | Refactor                 |
| `documentation`      | Documentation            |
| `test`               | Tests                    |
| `dependencies`       | Dependencies             |
| `ci` / `github_actions` | CI & Build            |
| *(none / unmatched)* | Other Changes            |
| `ignore-for-release` | Hidden from notes        |

**Exception for first-party dependency bumps.** When bumping a package we own (`@chrischall/mcp-utils`, `@chrischall/realty-core`, `@fetchproxy/server` — anything published from a chrischall-owned repo), label the PR `enhancement` or `bug` instead of `dependencies`, and use the matching Conventional-Commit prefix (`feat:` or `fix:`) instead of `chore:`/`build(deps):`. Those bumps deliver real product fixes or features through us, so they should drive a release-please version bump and show up under Features/Bug Fixes in the release notes — not get hidden under "Dependencies" (which doesn't trigger a release).

The **PR title MUST be a Conventional Commit**, written user-facing (`fix(scope): …`, `feat(scope): …`), not internal shorthand. Because the repo squash-merges, the PR title *becomes the squash commit's subject line* — the only thing release-please parses to pick the version bump and changelog section. Only `feat` (minor), `fix` (patch), and `!`/`BREAKING CHANGE` (major) cut a release; `perf`/`refactor`/`docs` show in the changelog without bumping; `ci`/`test`/`build`/`chore` are recognised but hidden (see `release-please-config.json` → `changelog-sections`). A title without a conventional type is invisible to release-please — no bump, no changelog line. Prefixes in *individual commits* don't help; squash keeps only the title.

### How PRs merge

**Don't run `gh pr merge` yourself.** The automation does it:

1. `pr-auto-review.yml` (a thin stub calling `chrischall/workflows`) runs a Claude review on every PR **except** the release-please release PR (which it deliberately skips). It emits a verdict — `pass` / `warn` / `fail`. On `pass` **or** `warn` it adds the `ready-to-merge` label (nits don't block); on `warn` or `fail` it also opens/updates an `auto-review-followup` issue (see below). Only `fail` blocks.
2. `auto-merge.yml`, on the `ready-to-merge` label (or on a dependabot PR), arms `gh pr merge --auto --squash`. The moment CI is green the PR squash-merges itself.

For ordinary feature/fix PRs, opening with `gh pr create --label <label>` (or `--label ignore-for-release` for chores not worth a release-notes line) is the whole job. If Claude's verdict was `fail` but you've decided to ship anyway, add the label yourself: `gh pr edit <num> --add-label ready-to-merge`.

### Auto-review follow-up issues

When a PR's auto-review verdict is `warn` or `fail`, the `chrischall/workflows` pipeline opens or updates a single `auto-review-followup` issue ("Auto-review follow-ups for PR #N") whose checklist captures every finding, and links it from the PR's `<!-- auto-review-verdict -->` comment (`📋 Tracking follow-ups: #N`). `warn` (nits only) still auto-merges — the issue carries the nits forward, so most nits are fixed in a *later* PR; `fail` blocks until the important findings are addressed on the PR itself.

When asked to address the auto-review comments / review findings on a PR:

1. Read the verdict comment, open the linked `auto-review-followup` issue, and treat its checklist as the work list (alongside any inline review comments).
2. Resolve each item, checking off only what you've **verified** is genuinely fixed.
3. If every item is resolved on the current PR, add `Closes #<issue>` to that PR's body so the merge closes it; if some are deferred, check off only the resolved ones and leave the issue open.
4. For nits whose `warn` PR already auto-merged, address them in a follow-up PR that references `Closes #<issue>`.

(Mirrors the fleet-wide convention in `~/.claude/CLAUDE.md`.)

### PR timing — only open when the feature is done

Because PRs auto-merge as soon as auto-review passes, **do not open a PR until the feature is genuinely complete**. There's no draft-PR safety net here:

- Don't open a PR to "stage" work while live verification, follow-up fixes, or final passes are still pending — by the time you finish those, the half-baked PR may already be in `main`.
- Push commits to the branch first; only run `gh pr create` once tests pass, live verification (if applicable) is green, and you'd be comfortable with the change shipping as-is.
- If follow-ups land after a PR is already open, they need to land on the same branch *before* auto-review flips to `pass`. Once the PR squash-merges, late commits orphan onto a stale branch and become their own follow-up PR.
- If you genuinely need a checkpoint review without shipping, open the PR as a GitHub draft (`gh pr create --draft …`) — auto-review skips drafts. Mark it ready-for-review only when the feature is truly done.

**Release PRs are the one manual touch.** release-please opens its own release PR and leaves it open as your staging artifact — `pr-auto-review.yml` skips it on purpose, so it sits there accumulating changes until you decide to ship. When you're ready, add `ready-to-merge` to it the same way: `gh pr edit <num> --add-label ready-to-merge`. The `auto-merge.yml` arm then takes over and the publish job fires the moment the release PR lands.

The repo allows squash-merge only — `--merge` and `--rebase` are blocked at the branch-protection ruleset level.

## Gotchas

- **ESM + NodeNext**: imports must use `.js` extensions even for `.ts` source files (e.g. `import { TempoClient } from './client.js'`).
- **Rate limiting / auth / timeout**: configured once via `createApiClient` in `client.ts` — `retry: { count: 1, delayMs: 2000 }` (429 retried once after 2 s, then `Rate limited by Tempo API`), `onUnauthorized` → `TEMPO_API_TOKEN is invalid or expired` (distinct from the missing-token message), `timeout: 30_000`. Change behaviour there, not per handler.
- **API base**: all requests go to `https://api.tempo.io` with paths like `/4/worklogs`. The `/4/` prefix is part of each handler's `path`, not the base.
- **Env-var sanitisation**: use `readEnvVar` from `@chrischall/mcp-utils` (treats blank, literal `undefined`/`null`, and unsubstituted `${FOO}` as missing) for any new env vars — don't hand-roll parsing.
- **stdio transport**: `runMcp` prints the AI-maintained banner to **stderr** only — stdout is reserved for JSON-RPC; `loadDotenvSafely` is likewise quiet. Never `console.log` from a handler.
- **Build before run**: `dist/` must exist before running the server manually. `npm run build` runs `tsc` (→ `dist/index.js`, the npm bin) then `npm run bundle` = esbuild (→ `dist/bundle.js`, the MCPB entry point, with `dotenv` left external).
- **Tool registration shape**: tools use `server.registerTool(name, { description, annotations, inputSchema }, handler)` with raw Zod field objects in `inputSchema` (not a full `z.object`). Mutating tools should set `annotations.readOnlyHint: false`.
- **Plan/account body builders**: `plans.ts` and `accounts.ts` define `buildPlanBody`/`buildAccountBody` (built on `buildOptionalBody` from mcp-utils, driven by `*_REQUIRED`/`*_OPTIONAL` field-name tuples) so create and update stay in sync — extend the tuple + the field schema, not each handler, when adding fields.
- **Plugin files**: `.claude-plugin/`, `manifest.json`, `server.json`, and `skills/tempo-api-mcp/SKILL.md` are for distribution channels (Claude Code plugin, MCPB, MCP Registry, ClawHub) — not part of the MCP runtime.
