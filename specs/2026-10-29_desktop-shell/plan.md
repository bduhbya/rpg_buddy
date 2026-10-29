# Phase 3: Runnable desktop shell - Plan

## Branch and starting point

- Topic branch: `phase/2026-10-29-desktop-shell`, verified before authoring.
- Starting base: `main`, commit `e170b1b3108df38a1ed2480fa67cb4ac1f9405b4`.
- Initial working tree: clean. Local date: 2026-10-29.

## Confirmed decisions

The user accepted the grouped plan, requirements and validation proposals, requesting the most recent available toolchains. Use latest stable releases verified against npm and official documentation; pin direct dependencies and commit the lockfile. Use npm, Electron Forge and its supported Webpack plugin (user-authorized revision below supersedes the initial Vite choice). Keep this phase limited to the runnable shell. Install a current Node/npm locally for verification rather than replacing the user's global installation.

## Tasks

- [x] P1: Establish compatible current Electron/React/TypeScript/Forge/Webpack tooling and reproducible npm scripts (DS-1). Complete when clean dependency installation and type checking work.
- [x] P2: Implement isolated desktop startup and the minimal semantic React screen (DS-2, DS-3). Complete when development and packaged launches display it.
- [x] P3: Add proportionate Playwright Electron smoke checks and usage instructions (DS-4, DS-5). Complete when both launch modes and startup diagnostics are checked.
- [x] P4: Run required validation, record evidence and mark roadmap Phase 3 complete only if checks pass (DS-1 through DS-5).

## Dependencies and boundaries

Phases 1 and 2 are complete. Typed IPC and runtime request validation belong to Phase 4; domain/rules, sheets and persistence remain later phases. No installers, signing or distribution automation. Preserve the existing Python verifier and VS Code configuration.

## Initial Vite completion evidence (superseded by Webpack revision)

Phase 3 completed on 2026-10-29. Clean `npm ci`, strict type checking, Forge production packaging and both Playwright smoke projects passed on Windows x64. See validation.md for actual results, limitations and reproduction. No contract, Python verifier or VS Code configuration changes were needed.

Verified direct versions: Node 26.13.0, npm 12.2.1, Electron 45.1.0, Electron Forge CLI/Vite plugin 8.0.1, Vite 8.3.5, React/React DOM 19.3.1, TypeScript 7.0.2, Playwright 1.64.1, React Vite plugin 6.1.2, @types/node 26.6.6 and React/React DOM types 19.3.0. npm latest tags and the official Node release index were checked before installation. Exact npm dependency versions are recorded in package.json/package-lock.json.

Implementation adjustments: Forge 8 emits main.cjs, so package.main uses that filename. The development smoke test launches the actual Forge CLI and attaches to its renderer over a temporary localhost CDP port because Forge has no no-launch CLI option; packaged checks launch the executable via Playwright's Electron API. Native ESM package configuration avoids Vite's CommonJS configuration warning. The first cold-start smoke attempt exceeded the original five-second heading wait during dependency optimization; it now allows 30 seconds, bounded by the 90-second test timeout. Clean-install validation then passed. Initial compiler findings in the test harness were fixed before final validation; no compiler exclusions or application security settings were relaxed.

## Webpack revision - planned 2026-10-29

User explicitly requested replacing the experimental Forge Vite integration with the supported Forge Webpack plugin, retaining Vitest as the unit-test framework. Continue this phase on its existing branch and reuse these documents. No new scope or approval gate.

- [x] W1: Replace bundler dependencies/configuration, entry-point constants and development asset handling; retain isolation and existing UI. Complete when strict checks and packaging succeed.
- [x] W2: Update launch checks and setup instructions for Webpack. Complete when clean installation and both smoke modes pass.
- [x] W3: Record new results and supersede Vite-specific evidence while preserving its historical context.

Webpack revision complete: clean locked install, strict checks, production packaging and both launch checks pass. Current evidence and audit limitation are in validation.md. Vitest selection and phase scope are unchanged.

## Prettier configuration - planned 2026-10-29

User requested Prettier formatting. Add a pinned current Prettier dependency, explicit style configuration, generated/environment exclusions, npm write/check commands and VS Code language-scoped format-on-save settings. Apply formatting to supported repository files, preserving content and behavior. Validate with format check, strict TypeScript checks, production packaging, both launch smoke tests and the existing contract verifier because JSON fixtures may be formatted. Record results below and in validation.md.

Prettier addition complete: exact dependency and write/check commands configured, formatting applied to supported files, editor defaults/recommendation supplied, negative drift and exclusion checks passed. JSON semantic comparison, 22 contract tests, strict TypeScript checking, packaging and both launch checks passed. See validation.md for evidence.
