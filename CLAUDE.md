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

Version is set in **four places** — keep them in sync on every release:

1. `package.json` → `version`
2. `src/index.ts` → `{ name: 'tempo-api-mcp', version: '...' }` in the Server constructor
3. `.claude-plugin/plugin.json` → `version`
4. `.claude-plugin/marketplace.json` → `metadata.version` and `plugins[0].version` and `plugins[0].source.version`

## Gotchas

- **ESM + NodeNext**: imports must use `.js` extensions even for `.ts` source files (e.g. `import { TempoClient } from './client.js'`).
- **Rate limiting**: 429 responses are retried once after 2 s; second 429 throws.
- **API base**: all requests go to `https://api.tempo.io/4/`.
- **Startup validation**: `TempoClient` throws immediately if `TEMPO_API_TOKEN` is missing.
- **Build before run**: `dist/` must exist before running the server manually.
- **Plugin files**: `.claude-plugin/` and `SKILL.md` are for Claude Code plugin distribution — not part of the MCP runtime.
