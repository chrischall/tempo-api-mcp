# Registry submissions — tempo-api-mcp

Ready-to-paste copy for registries that need a manual browser-form submission. Automated pipelines fire on every `v*` tag via `.github/workflows/release.yml`.

## Coverage matrix

| Registry                          | Automated?                               | Where |
| --- | --- | --- |
| npm                               | ✅ `release.yml`                          | `npm publish --provenance` |
| GitHub Releases                   | ✅ `release.yml`                          | `.skill` + `.mcpb` attached |
| modelcontextprotocol/registry     | ✅ `release.yml` (OIDC)                   | `mcp-publisher publish` using `server.json` |
| PulseMCP                          | ✅ transitive (auto-ingests weekly)       | — |
| ClawHub (OpenClaw)                | ✅ conditional on `CLAWHUB_TOKEN`         | `clawhub skill publish` |
| mcpservers.org                    | ❌ manual — [mcpservers.org/submit](https://mcpservers.org/submit) | |
| Anthropic community plugins       | ❌ manual — [clau.de/plugin-directory-submission](https://clau.de/plugin-directory-submission) | |

## mcpservers.org

- **Server Name:** `tempo-api-mcp`
- **Short Description:** `Tempo time-tracking and resource planning for Claude — log time, manage worklogs, check resource allocations, and review timesheet approvals via natural language`
- **Link:** `https://github.com/chrischall/tempo-api-mcp`
- **Category:** `Productivity`
- **Contact Email:** `chris.c.hall@gmail.com`

## Anthropic community plugins

- **Repo URL:** `https://github.com/chrischall/tempo-api-mcp`
- **Plugin name:** `tempo-api-mcp`
- **Short description:** `Tempo time-tracking and resource planning for Claude — log time, manage worklogs, check resource allocations, and review timesheet approvals via natural language`
- **Category:** Productivity
- **Tags:** tempo, jira, time-tracking, worklogs, atlassian, mcp
