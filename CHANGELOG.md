# Changelog

## [2.4.0](https://github.com/chrischall/tempo-api-mcp/compare/v2.3.2...v2.4.0) (2026-09-01)


### Features

* **health:** add tempo_healthcheck ([#127](https://github.com/chrischall/tempo-api-mcp/issues/127)) ([a27848a](https://github.com/chrischall/tempo-api-mcp/commit/a27848a0fe04dc7ee18db56e9c06b6c2d7206482))


### Documentation

* **health:** list tempo_healthcheck in manifest.json and the tool docs ([#130](https://github.com/chrischall/tempo-api-mcp/issues/130)) ([c65dcb1](https://github.com/chrischall/tempo-api-mcp/commit/c65dcb1f42a7acc14d1bf24170a0624b6c9add30))

## [2.3.2](https://github.com/chrischall/tempo-api-mcp/compare/v2.3.1...v2.3.2) (2026-08-27)


### Documentation

* npm test now typechecks before running vitest ([#118](https://github.com/chrischall/tempo-api-mcp/issues/118)) ([59b9df3](https://github.com/chrischall/tempo-api-mcp/commit/59b9df3e9996bafce97fc4d467aeec84199994b1))

## [2.3.1](https://github.com/chrischall/tempo-api-mcp/compare/v2.3.0...v2.3.1) (2026-07-31)


### Bug Fixes

* **worklogs:** support required Tempo work attributes on create/update ([#97](https://github.com/chrischall/tempo-api-mcp/issues/97)) ([4aa8a9b](https://github.com/chrischall/tempo-api-mcp/commit/4aa8a9b508c6e0f345b35fa261971051a781dce7))

## [2.3.0](https://github.com/chrischall/tempo-api-mcp/compare/v2.2.0...v2.3.0) (2026-07-28)


### Features

* **timesheets:** add team approvals and timesheet reviewers tools ([#93](https://github.com/chrischall/tempo-api-mcp/issues/93)) ([9b14a57](https://github.com/chrischall/tempo-api-mcp/commit/9b14a57e3da79a4cbed47736d9b87f3bfa02f2a3))


### Bug Fixes

* **timesheets:** require the period params the API declares mandatory ([#95](https://github.com/chrischall/tempo-api-mcp/issues/95)) ([45e1e64](https://github.com/chrischall/tempo-api-mcp/commit/45e1e64d08fb23567258439cf95cc9a13951ef76))
* **tools:** align tool schemas with the endpoints Tempo actually exposes ([#96](https://github.com/chrischall/tempo-api-mcp/issues/96)) ([62a5121](https://github.com/chrischall/tempo-api-mcp/commit/62a51219505bdb987bce1b9472ba89358d4632b4))

## [2.2.0](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.9...v2.2.0) (2026-07-28)


### Features

* **timesheets:** add submit, approve, reject, reopen, and recall tools ([#91](https://github.com/chrischall/tempo-api-mcp/issues/91)) ([0c7ecbc](https://github.com/chrischall/tempo-api-mcp/commit/0c7ecbc371763ef442ccab1b22246b83a8c9f7db))

## [2.1.9](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.8...v2.1.9) (2026-07-19)


### Documentation

* replace duplicated fleet policy with a pointer ([#82](https://github.com/chrischall/tempo-api-mcp/issues/82)) ([a245fc5](https://github.com/chrischall/tempo-api-mcp/commit/a245fc56e4513b70f8bd02c4231fbdb224301674))

## [2.1.8](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.7...v2.1.8) (2026-07-13)


### Bug Fixes

* **plugin:** move SKILL.md into skills/ directory so plugin skills load ([#79](https://github.com/chrischall/tempo-api-mcp/issues/79)) ([d667d8e](https://github.com/chrischall/tempo-api-mcp/commit/d667d8ebef9ff6c115e01b39ee7b5a6310f96ef5))
* **plugin:** restore skill staging in publish flow (follow-up to [#79](https://github.com/chrischall/tempo-api-mcp/issues/79)) ([#81](https://github.com/chrischall/tempo-api-mcp/issues/81)) ([7ece58d](https://github.com/chrischall/tempo-api-mcp/commit/7ece58d40145c4deef3cb774412a00d670ba545d))

## [2.1.7](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.6...v2.1.7) (2026-07-07)


### Bug Fixes

* bump @chrischall/mcp-utils to 0.12.0 ([#74](https://github.com/chrischall/tempo-api-mcp/issues/74)) ([a83b5d3](https://github.com/chrischall/tempo-api-mcp/commit/a83b5d378290110d880ad8023a104d1a8a4c8102))
* confirm-gate Tempo write tools ([#70](https://github.com/chrischall/tempo-api-mcp/issues/70)) ([cf07afb](https://github.com/chrischall/tempo-api-mcp/commit/cf07afb3ca8896a83428935ddaee5bdbd7dc9d1e))
* tempo_delete_worklog dry-run preview + dry-run tests for accounts/teams ([#73](https://github.com/chrischall/tempo-api-mcp/issues/73)) ([96ef77a](https://github.com/chrischall/tempo-api-mcp/commit/96ef77a08b93681014ea86a50c5a83b0ec0b31b8))


### Documentation

* document first-party dependency-bump label exception ([#75](https://github.com/chrischall/tempo-api-mcp/issues/75)) ([154e627](https://github.com/chrischall/tempo-api-mcp/commit/154e6279c30661ea903dc2d5555a3a0d938deb01))

## [2.1.6](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.5...v2.1.6) (2026-07-05)


### Documentation

* correct stale ship-label comment in release-please workflow ([#58](https://github.com/chrischall/tempo-api-mcp/issues/58)) ([d561f89](https://github.com/chrischall/tempo-api-mcp/commit/d561f892208af2ea7dd62840cf0c56fa69ffb690))
* refresh CLAUDE.md for mcp-utils refactor + auto-review follow-ups ([#57](https://github.com/chrischall/tempo-api-mcp/issues/57)) ([ecbdd9f](https://github.com/chrischall/tempo-api-mcp/commit/ecbdd9f44990fd0b4e8dbcdd158075c9497f1ef9))
* require Conventional Commit PR titles for release-please ([#53](https://github.com/chrischall/tempo-api-mcp/issues/53)) ([73609c8](https://github.com/chrischall/tempo-api-mcp/commit/73609c8f3e6385edfdcaf382c78c6669d17a2a47))

## [2.1.5](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.4...v2.1.5) (2026-06-13)


### Bug Fixes

* bot PRs bypass the CI gate unconditionally (upstream curtaincall[#86](https://github.com/chrischall/tempo-api-mcp/issues/86) review) ([#48](https://github.com/chrischall/tempo-api-mcp/issues/48)) ([508e3ec](https://github.com/chrischall/tempo-api-mcp/commit/508e3ec149c1c50f88be4b9e5e2ddea16c0e02e6))


### Documentation

* correct Versioning section to describe release-please ([#43](https://github.com/chrischall/tempo-api-mcp/issues/43)) ([27a6af2](https://github.com/chrischall/tempo-api-mcp/commit/27a6af2184b2bfdd69da726e8ca6fcc8ed5a51ab))
* declare MIT license and add README badges ([#49](https://github.com/chrischall/tempo-api-mcp/issues/49)) ([4961733](https://github.com/chrischall/tempo-api-mcp/commit/49617335f3201244148beaf06669db1989bab019))

## [2.1.4](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.3...v2.1.4) (2026-05-29)


### Bug Fixes

* **ci:** auto-merge arm guards ([#31](https://github.com/chrischall/tempo-api-mcp/issues/31)) ([c9d028f](https://github.com/chrischall/tempo-api-mcp/commit/c9d028f66d4a095c7f881e0e6260993a9b6d73e0))

## [2.1.3](https://github.com/chrischall/tempo-api-mcp/compare/v2.1.2...v2.1.3) (2026-05-26)


### Bug Fixes

* **ci:** substitute repo name in publish workflow ([#28](https://github.com/chrischall/tempo-api-mcp/issues/28)) ([62fec25](https://github.com/chrischall/tempo-api-mcp/commit/62fec256b37f8370afb88aaa5429903d43237695))

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
