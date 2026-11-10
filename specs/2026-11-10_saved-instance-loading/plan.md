# Phase 17 plan

Topic branch `phase/2026-11-10-saved-instance-loading` from `main` at `1d1fc1cf824e95fd07ff017eaf6aec1caebf5ba8`. The working tree was clean. On 2026-11-10 the user confirmed the loading policy, two review steps and the validation approach.

## Step 1 — Validate a stored snapshot

- [x] Specify the phase in [requirements](requirements.md) and [validation](validation.md).
- [x] Implement the [definition-independent TypeScript validator](../../src/domain/instances/validate-instance-snapshot.ts) for parsed v2 snapshots (SL-1, SL-2). It returns the stored sheet on success and located diagnostics on failure.
- [x] [Exercise both role fixtures and malformed snapshots](../../tests/unit/domain/validate-instance-snapshot.test.ts). Record V1 and the applicable repository checks.

**Review checkpoint.** Review feedback requested [shared section validation](../../src/domain/instances/check-sections.ts) with existing diagnostics preserved. The focused regression tests assert both validators' original messages and locations.

## Step 2 — Open a saved file and determine editing availability

- [x] Add the [main-process loader](../../src/main/instance-loader.ts) that resolves and checks the canonical sheet path, parses strict JSON and validates the snapshot before looking up definitions (SL-3).
- [x] Use the exact archived definition lookup and [verify snapshot compatibility](../../src/domain/instances/check-instance-template.ts). Return the recorded sheet with editable or read-only status, or diagnostics when the sheet is invalid (SL-4).
- [x] Record correlated load checkpoints and outcomes through the existing main-process logger, and verify representative events and failure reasons (SL-6, V6).
- [x] Run the disposable-library checks and repository validation, record the evidence, and update the roadmap when the completion requirements are met (SL-5).
