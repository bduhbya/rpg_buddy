# Phase 11: Rogue Trader runtime definitions

Branch: `phase/2026-11-04-rogue-trader-runtime-definitions`.
Starting base: `main` at `38f5dbd2d865e7240bad0c6518db4cad2885c7a3`. The working tree was clean; branch checkout was verified before writing these documents.

The user confirmed the bounded scope, two steps with a human review pause, and automated checks plus a documented walkthrough on 2026-11-04. Separate human walkthrough execution is not a completion gate.

## Step 1: Runtime definitions and documentation

- [x] Promote the approved manifest and shared creature template to canonical runtime-library paths, including the identical archived manifest (RD-1, RD-2). Complete when the three JSON files match the approved content apart from removal of optional development metadata.
- [x] Document runtime content, scope, citations, defaults, ownership and deferred integration; link from the repository README (RD-2, RD-3, RD-5). Complete when a reader can distinguish runtime definitions from example snapshots and contract fixtures.
- [x] Inspect canonical paths, content equality, fields and citations; run existing unit, type, Python integrity and formatting checks. Record evidence in validation.md. Hand back for human review before Step 2.

This step introduces only maintained data and documentation, with no loader or application wiring.

## Step 2: Runtime acceptance and completion

- [x] After Step 1 review, add focused Vitest acceptance reading the runtime files as unknown JSON and validating/resolving them through the production catalog/resolver (RD-1, RD-4).
- [x] Exercise representative fixture-owned character/Ork snapshots, independent expected values, edited and boundary inputs, generic target behavior and invalid effects against the runtime template (RD-2, RD-3, RD-4). Complete when assertions fail on incompatible data rather than deriving expected results from another evaluator.
- [x] Run the full agreed checks, document a reproducible human walkthrough, and update the roadmap only after all completion requirements pass (RD-6).

Step 2 owns new maintained runtime-data acceptance tests. Existing tests and inspection provide Step 1 verification without claiming that dedicated runtime acceptance already exists. UI, persistence, packaging, new instance creation and feature catalogs remain deferred.

## Step 1 checkpoint

Completed on 2026-11-04. Runtime content and documentation are ready for human review. The active and archived manifests match the approved fixture exactly. The template matches the approved fixture after recursively removing only optional metadata. No application/domain implementation or fixture content was changed. Existing regression checks passed; dedicated runtime API acceptance remains Step 2. Await human feedback before starting Step 2. The phase and roadmap remain incomplete.

## Step 2 completion

The user authorized Step 2 on 2026-11-04 after the Step 1 checkpoint. Added tests/unit/domain/rogue-trader-runtime-definitions.test.ts: 13 acceptance cases read real runtime files as unknown JSON, cross the production validation/resolution boundary and assert independent results. No production code or application integration changed. All 274 unit tests in 14 files, strict TypeScript, 10 Python integrity groups, formatting and whitespace checks passed. The initial focused run exposed an incorrect expected diagnostic code in the new test; it was corrected to the existing INVALID_MODIFIER contract and rerun successfully. Both steps and RD-6 are complete. Phase 12 In-memory instance creation is next; no work on that phase is included.
