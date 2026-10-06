# tempo-api-mcp

[![CI](https://github.com/chrischall/tempo-api-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/chrischall/tempo-api-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tempo-api-mcp)](https://www.npmjs.com/package/tempo-api-mcp)
[![license](https://img.shields.io/npm/l/tempo-api-mcp)](LICENSE)

Tempo API MCP server for Claude — developed and maintained by AI (Claude Code)

## Confirmations

Every write (create/update/delete, and the timesheet submit/approve/reject/reopen/recall actions) asks the user to confirm before it changes anything: a confirmation prompt where the client supports one; otherwise the first call returns a preview of exactly what would be sent plus a `confirmToken`, and only a repeat call with that token proceeds.

| variable | default | |
|---|---|---|
| `MCP_CONFIRM_MODE` | `ask-user` | What a write does on a client that cannot show a confirmation prompt (claude.ai, Claude Desktop). `ask-user`: two steps — the first call does nothing and returns a preview plus a token, and the model must get your approval in chat before calling again with it. `auto`: the same two steps, but the model may use the token after reviewing the preview itself. `refuse`: writes are refused on such clients. A client that can show prompts (Claude Code) gets the real prompt unless `MCP_CONFIRM_ELICITATION=off`. An unrecognised value is treated as `refuse`. |
| `MCP_CONFIRM_ELICITATION` | `on` | `off` never shows a confirmation prompt, so every client gets the `MCP_CONFIRM_MODE` two-step flow. **Set it for opencode v2**: it claims to support prompts but never displays them, so writes (including timesheet approvals) hang. Any other value stays `on`. |
| `MCP_CONFIRM_TTL_SECONDS` | `600` | How long a token stays valid. |
| `MCP_CONFIRM_SECRET` | random per process | Signing key; set it only if tokens must survive a server restart. |

In opencode, set it in the server's `environment` block:

```json
{
  "mcp": {
    "servers": {
      "tempo": {
        "type": "local",
        "command": ["npx", "-y", "tempo-api-mcp"],
        "environment": { "TEMPO_API_TOKEN": "…", "MCP_CONFIRM_ELICITATION": "off" }
      }
    }
  }
}
```
