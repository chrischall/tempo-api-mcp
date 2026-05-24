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
  index.ts          # MCP server entry — instantiates TempoClient + McpServer, calls each tool module's register()
  client.ts         # TempoClient — Bearer auth, 429 single-retry, env-var parsing with placeholder defence
  tools/
    worklogs.ts     # worklogs CRUD + search + by-user/project/issue/team/account
    plans.ts        # plans CRUD (resource allocations)
    teams.ts        # teams CRUD + team-memberships list/search
    accounts.ts     # accounts CRUD + search + categories
    projects.ts     # projects, timesheet approvals/logs, periods, user-schedule, global config, work attributes, roles
```

Each tool file exports `register(server: McpServer, client: TempoClient)` and calls `server.registerTool(name, def, handler)` for each tool. To add a new domain, create `src/tools/<name>.ts` with a `register` export and wire it in `src/index.ts`.

The server uses the high-level `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` (not the lower-level `Server`).

## Environment

```
TEMPO_API_TOKEN=   # required — Bearer token from Tempo → Settings → API integration
```

Loaded from `.env` at the repo root via `dotenv` (silent failure if dotenv is unavailable, e.g. inside the mcpb bundle). `TempoClient` throws immediately on construction if `TEMPO_API_TOKEN` is missing/blank/unsubstituted (`${FOO}` literal) — defends against MCP hosts that pass `.mcp.json` env blocks through unexpanded.

## Testing

Tests live in `tests/` (one file per tool module + `client.test.ts`). Run with `npm test`. No real API calls — `fetch` is stubbed in `client.test.ts` and `TempoClient.request` is mocked elsewhere. `vitest.config.ts` enables v8 coverage but does **not** enforce thresholds.

## Plugin / Marketplace

```
.claude-plugin/
  plugin.json       # Claude Code plugin manifest (MCP server config via npx)
  marketplace.json  # Marketplace catalog entry
manifest.json       # Anthropic MCPB manifest (used by `npx @anthropic-ai/mcpb pack`)
server.json         # modelcontextprotocol/registry submission
SKILL.md            # Claude Code skill — teaches Claude when/how to use the tools
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
3. `src/index.ts` → `McpServer` constructor `version` field
4. `manifest.json` → `"version"`
5. `server.json` → `"version"` and every `packages[].version`
6. `.claude-plugin/plugin.json` → `"version"`, and `.claude-plugin/marketplace.json` → `metadata.version` + every `plugins[].version`

### Important

Do NOT manually bump versions or create tags unless the user explicitly asks. Versioning is handled by the **Tag & Bump** GitHub Action (`.github/workflows/tag-and-bump.yml`).

### Release workflow

Main is always one version ahead of the latest tag. To release, run the **Tag & Bump** workflow which:

1. Runs CI (`ci.yml`: build + test)
2. Tags the current commit with the current version (`v${CURRENT}`)
3. `npm version patch --no-git-tag-version`, then sed-bumps `src/index.ts` and a node script walks every JSON version field across `manifest.json`, `server.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
4. Rebuilds, commits, pushes `main` + the new tag

The tag push triggers `release.yml`, which:

- Rebuilds, packages a `SKILL.md`-only `.skill` zip, and `npx @anthropic-ai/mcpb pack` → `.mcpb` bundle
- `npm publish --access public --provenance`
- Publishes to the MCP Registry via `mcp-publisher` (GitHub OIDC)
- Conditionally publishes the skill to ClawHub (skipped if `CLAWHUB_TOKEN` is not set)
- Creates a GitHub Release with `generate_release_notes: true`, attaching `.skill` and `.mcpb`

<!-- pr-workflow:v1 -->
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

The **PR title** becomes the bullet — write it like a user-facing changelog entry (`ck_set_session: refuse stale refresh tokens`), not internal shorthand (`auth tweaks`). Conventional-commit prefixes (`feat:`, `fix:`, `chore:`) are still fine in commit messages, but the PR title should read clean.

### How PRs merge

**Do not manually merge PRs — including the release-please release PR.** Open with `gh pr create --label <label>` (or `--label ignore-for-release` for chores not worth a release-notes line). That is the whole job. Do **not** run `gh pr merge --auto --squash` yourself.

The automation handles the rest:

1. `pr-auto-review.yml` runs a Claude review on every PR. On a `pass` verdict it adds the `ready-to-merge` label.
2. `release-please.yml` adds the `ready-to-merge` label to its own release PR automatically.
3. `auto-merge.yml`, on the `ready-to-merge` label (or on a dependabot PR), arms `gh pr merge --auto --squash` for you. The moment CI is green the PR squash-merges itself.

If Claude's review verdict was `warn` or `fail` but you've decided to ship anyway, add the label yourself: `gh pr edit <num> --add-label ready-to-merge`. The repo allows squash-merge only — `--merge` and `--rebase` are blocked at the branch-protection ruleset level.

## Gotchas

- **ESM + NodeNext**: imports must use `.js` extensions even for `.ts` source files (e.g. `import { TempoClient } from './client.js'`).
- **Rate limiting**: a 429 response is retried once after a 2 s wait; a second 429 throws `Rate limited by Tempo API`.
- **API base**: all requests go to `https://api.tempo.io` with paths like `/4/worklogs`. The `/4/` prefix is part of each handler's `path`, not the base.
- **Auth errors**: 401 throws `TEMPO_API_TOKEN is invalid or expired` (distinct message from missing token).
- **Env-var sanitisation**: `readVar()` in `client.ts` treats blank, literal `undefined`/`null`, and unsubstituted `${FOO}` as missing — match this pattern if you add more env vars.
- **stdio transport**: server logs the AI-maintained disclaimer to **stderr** only — stdout is reserved for JSON-RPC. `dotenv.config()` is called with `quiet: true` for the same reason.
- **Build before run**: `dist/` must exist before running the server manually. `npm run build` runs `tsc` (→ `dist/index.js` for the npm bin) then `esbuild` (→ `dist/bundle.js`, the MCPB entry point).
- **Tool registration shape**: tools use `server.registerTool(name, { description, annotations, inputSchema }, handler)` with raw Zod field objects in `inputSchema` (not a full `z.object`). Mutating tools should set `annotations.readOnlyHint: false`.
- **Plan/account body builders**: `plans.ts` and `accounts.ts` use `buildPlanBody`/`buildAccountBody` helpers so update and create stay in sync — extend the helper, not each handler, when adding fields.
- **Plugin files**: `.claude-plugin/`, `manifest.json`, `server.json`, and `SKILL.md` are for distribution channels (Claude Code plugin, MCPB, MCP Registry, ClawHub) — not part of the MCP runtime.
