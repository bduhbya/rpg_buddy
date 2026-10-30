# Phase 6: Domain module foundation - Plan

## Starting point

Topic branch: `phase/2026-10-30-domain-module-foundation`, verified before documentation. Starting base: `main` at `4e9fb318c8d94d366893627ce812ca0786c1ccf2`. Initial working tree clean. User accepted the three grouped proposals on 2026-10-30, including pauses after reviewable steps.

## Step 1: Domain document types

- [x] P1 (DF-1): Add small, related declaration modules for shared references/metadata, expressions, documents and diagnostics. Complete when all schema properties and normative codes are represented and strict type checking, formatting and inspection pass.
- [x] P2 (DF-1, DF-3): Record results and explain the declarations and their runtime-validation limits for human review.

Review checkpoint: stop after step 1 and wait for feedback or instruction to continue. No test harness or dependency installation in this step.

## Step 2: Fixture harness and boundary checks

- [x] P3 (DF-2): Add Vitest and a focused unit-test command/configuration, following the existing toolchain. Inspect current official compatibility guidance before selecting a version; do not upgrade unrelated dependencies. Exercise the authored manifest, template and both instances; add meaningful compile-time contract cases.
- [x] P4 (DF-3): Add boundary checks, document the fixture/type walkthrough, run the agreed validation, record evidence and mark the roadmap complete only when completion requirements pass.

Dependencies: P3 follows reviewed P1/P2; P4 follows P3. Test-only fixture loading stays outside `src/domain/`. Keep JSON fixtures and application behavior unchanged. Full Electron packaging/smoke runs are unnecessary unless later changes affect application runtime or build behavior.

## Progress

Specifications written before implementation. Step 1 completed on 2026-10-30 and the user reviewed it and authorized step 2. Step 2 completed on the same date. Phase complete; see validation.md for evidence. Application runtime behavior and authored JSON fixtures are unchanged. Dependencies add pinned Vitest 5.0.5 and its required toolchain only; existing locked package versions are unchanged.
