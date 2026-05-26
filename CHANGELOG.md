# Changelog

## [2.1.2](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.1...v2.1.2) (2026-05-26)


### Documentation

* **claude:** warn against opening PRs before the feature is done ([#26](https://github.com/chrischall/tempo-api-mcp/issues/26)) ([a19e649](https://github.com/chrischall/tempo-api-mcp/commit/a19e6494ba4d554863be67e1fbfa134c00144b1f))

## [2.1.1](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.0...v2.1.1) (2026-05-25)


### Bug Fixes

* **ci:** prevent labeled event from cancelling auto-review ([#24](https://github.com/chrischall/tempo-api-mcp/issues/24)) ([08dd166](https://github.com/chrischall/tempo-api-mcp/commit/08dd166751885cf22929f1ecb76cbbf6c5d7ada9))

## [2.1.0](https://github.com/chrischall/tempo-api-mcp/compare/v2.0.3...v2.1.0) (2026-05-24)


### Features

* add .mcpb bundle support ([f1ac0a7](https://github.com/chrischall/tempo-api-mcp/commit/f1ac0a7f1983cf2aaaf0ab5a9280abf6216af783))
* **deploy:** registry listings for MCP Registry, Claude plugins, ClawHub, PulseMCP, mcpservers.org ([9b02b14](https://github.com/chrischall/tempo-api-mcp/commit/9b02b145e93eb4d2a217cf0a3b1ae9e5e5f7662c))


### Bug Fixes

* **client:** silence dotenv v17 stdout banner (breaks JSON-RPC over stdio) ([86ab7f1](https://github.com/chrischall/tempo-api-mcp/commit/86ab7f1885f3885d0fe62d50bc14c7d53a23ceb9))
* **deploy:** shorten server.json description to ≤100 chars for MCP Registry ([073d5d8](https://github.com/chrischall/tempo-api-mcp/commit/073d5d86bcb11a7069a9ad86d575196d029046b2))
* don't crash at install when env vars are missing; trim .mcpb ([ebd7795](https://github.com/chrischall/tempo-api-mcp/commit/ebd779506245e602a088a0fb38776ad42f481cd7))
* don't crash at install when env vars are missing; trim .mcpb ([1dfaf34](https://github.com/chrischall/tempo-api-mcp/commit/1dfaf34af0b1c82e4acd353353a83c364a149035))
* **env:** also reject literal "undefined"/"null" in readVar ([31e588d](https://github.com/chrischall/tempo-api-mcp/commit/31e588dfbb9883f4299b91a968638611950e3dce))
* **env:** treat blank/whitespace/placeholder env vars as unset ([ab1db9b](https://github.com/chrischall/tempo-api-mcp/commit/ab1db9bcde7435f16f1ab3a9603c1e3e581f7acb))


### Documentation

* add Acknowledgement of Terms section to SKILL.md ([#20](https://github.com/chrischall/tempo-api-mcp/issues/20)) ([9a3ae61](https://github.com/chrischall/tempo-api-mcp/commit/9a3ae61594d4b7caba32b8c0f753710d4ea9f2d2))
* canonical auto-merge guidance ([#21](https://github.com/chrischall/tempo-api-mcp/issues/21)) ([a53674f](https://github.com/chrischall/tempo-api-mcp/commit/a53674f65cee937238c0bfdcc7b2c2840a420ce2))
* **claude-md:** call out 100-char limit on server.json description ([98ce220](https://github.com/chrischall/tempo-api-mcp/commit/98ce2205f980f702300082dfc31dc97b36dcf798))
* **claude-md:** call out 100-char limit on server.json description ([e2bd0d6](https://github.com/chrischall/tempo-api-mcp/commit/e2bd0d6f248d7b2987b5a55b919d05d65cd4a3fe))
* ensure CLAUDE.md is current and complete ([53959df](https://github.com/chrischall/tempo-api-mcp/commit/53959df487c52dff678d6a03229f34896ffd517a))
* ensure CLAUDE.md is current and complete ([00c9e62](https://github.com/chrischall/tempo-api-mcp/commit/00c9e62b1e7f68715e346b9e8347654cc1eb00c5))
