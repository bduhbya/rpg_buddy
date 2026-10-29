# Phase 4: Secure application boundary - Plan

## Starting point and decisions

Topic branch: `phase/2026-10-29-secure-application-boundary`, verified before writing. Starting base: `main` at `abc8c4359e9e45bc5b75e5f0a044c33bf9fae877`. Initial tree clean. User accepted all three grouped proposals on 2026-10-29. Phases 1–3 are complete.

## Tasks

- [x] P1: Define a shared typed application-info contract and runtime validation (SB-1). Complete when valid and invalid payload behavior is verified.
- [x] P2: Add isolated preload and main IPC handling, trusted-frame checks and navigation restrictions (SB-2, SB-3). Complete when real Electron checks prove the restricted boundary.
- [x] P3: Display application info with accessible loading and error feedback (SB-4). Complete when both launch modes display the main-process information.
- [x] P4: Run validation, document usage and evidence, update roadmap (SB-1–SB-4). Complete only when required automated checks pass.

Dependencies: existing Forge/Webpack shell. Preserve contracts and unrelated work. Logging, filesystem bridges and game features remain later phases. No dependency upgrades are planned.

## Outcome and implementation adjustments

Completed 2026-10-29 on the recorded branch. The main process validates exact request shape, owning webContents, main frame and canonical document URL. The sandboxed preload exposes one fixed method and validates results; React displays version information and safe status/error feedback. Required checks passed; see validation.md.

Forge emits a packaged file URL with Windows separators and spaces. Normalize it with the standard URL parser before both loading and exact comparisons. Electron 45's sandbox no longer provides Node built-ins used by Forge's injected development client, so disable that client, hot replacement and automatic live reload. Webpack still rebuilds renderer changes; manually reload to display them, and restart after main/preload changes. This preserves the required sandbox rather than adding Node shims. README documents the development workflow adjustment.

Boundary contract tests reuse the existing Playwright runner without new dependencies; Vitest remains planned for domain unit testing. Test-only adversarial preloads are external fixtures, verified absent from the production ASAR. No generic production debug endpoint was introduced.

## Test organization refactor - 2026-10-29

User authorized splitting the shell test while preserving coverage. Reuse this phase branch and documents.

- [x] R1: Extract a test-scoped launch/diagnostics/cleanup fixture and split startup, boundary, accessibility, packaged IPC rejection and packaged failure feedback into named tests. Each test gets a fresh application; injected preloads and removed handlers cannot affect other tests.
- [x] R2: Preserve all original assertions and negative cases; run strict checking, formatting and both smoke projects against the existing packaged build, then record current results and update README test instructions. Application code and packaging are unchanged.
