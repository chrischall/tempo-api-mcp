# tempo-api-mcp

MCP server exposing the Tempo REST API (v4) to Claude via stdio transport.

## Commands

```bash
npm run build        # tsc → dist/
npm test             # vitest run
npm run test:watch     # vitest watch
npm run test:coverage  # coverage report
```

Run locally (requires built dist):
```bash
npm run dev          # node dist/index.js (must build first)
```

## Tool naming

All tools are prefixed `tempo_` (e.g. `tempo_get_worklogs`, `tempo_create_worklog`).

## Architecture

```
src/
  index.ts          # MCP server entry — wires tools to TempoClient
  client.ts         # TempoClient — auth, rate-limit retry, request helpers
  tools/
    worklogs.ts     # CRUD + search worklogs, by-user/project/issue/team/account
    plans.ts        # Resource allocation plans
    teams.ts        # Tempo teams
    accounts.ts     # Tempo accounts
    projects.ts     # Jira projects (via Tempo API)
```

Each tool file exports `toolDefinitions: Tool[]` and `handleTool(name, args, client)`. Wire new domains in `src/index.ts` following the same pattern.

## Environment

```
TEMPO_API_TOKEN=   # required — Bearer token from Tempo API settings
```

Can also use a `.env` file at the repo root (loaded automatically at startup via dotenv). `TempoClient` throws immediately on startup if the token is missing.

## Testing

Tests live in `tests/tools/`. Run with `npm test`. No real API calls — `TempoClient` is mocked in all tests.

## Plugin / Marketplace

```
.claude-plugin/
  plugin.json       # Claude Code plugin manifest (MCP server config)
  marketplace.json  # Marketplace catalog entry
SKILL.md            # Claude Code skill — teaches Claude when/how to use the tools
```

## Versioning

Version appears in FOUR places — all must match:

1. `package.json` → `"version"`
2. `package-lock.json` → run `npm install --package-lock-only` after changing package.json
3. `src/index.ts` → `Server` constructor `version` field
4. `manifest.json` → `"version"`

### Important

Do NOT manually bump versions or create tags unless the user explicitly asks. Versioning is handled by the **Cut & Bump** GitHub Action.

### Release workflow

Main is always one version ahead of the latest tag. To release, run the **Cut & Bump** GitHub Action (`cut-and-bump.yml`) which:

1. Runs CI (build + test)
2. Tags the current commit with the current version
3. Bumps patch in all four files
4. Rebuilds, commits, and pushes main + tag
5. The tag push triggers the **Release** workflow (CI + npm publish + GitHub release)

## Gotchas

- **ESM + NodeNext**: imports must use `.js` extensions even for `.ts` source files (e.g. `import { TempoClient } from './client.js'`).
- **Rate limiting**: 429 responses are retried once after 2 s; second 429 throws.
- **API base**: all requests go to `https://api.tempo.io/4/`.
- **Startup validation**: `TempoClient` throws immediately if `TEMPO_API_TOKEN` is missing.
- **Build before run**: `dist/` must exist before running the server manually.
- **Plugin files**: `.claude-plugin/` and `SKILL.md` are for Claude Code plugin distribution — not part of the MCP runtime.
