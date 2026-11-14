# Phase 19 plan

Topic branch `phase/2026-11-13-safe-instance-saving` from `main` at `0fcaefe812b12205dd1417be07ccb2000be844d7`. The working tree was clean. On 2026-11-13, the user confirmed two steps with an intermediate review, the save and recovery policy, and review of recorded evidence.

## Step 1 — Safely write a validated snapshot

- [x] Specify the phase in [requirements](requirements.md) and [validation](validation.md).
- [x] Build a [main-process writer](../../src/main/instance-saver.ts) that validates the candidate and any predecessor, derives the canonical target and stages revisions before publishing (SS-1–SS-4).
- [x] Verify focused write, rejection, failure, and diagnostic cases (V1–V3).

**Review checkpoint.** Review the validation boundary, overwrite ordering, and the on-disk evidence before starting Step 2.

## Step 2 — Verify round trips and document recovery

- [x] Exercise both roles through the writer and existing loader with calculations disabled by a failing formula (SS-1, V4).
- [x] Document [manual recovery](../../README.md#recovering-a-saved-sheet), including interruption and abandoned write locks. Rehearse recovery in a disposable library, run repository checks, and update the roadmap after acceptance (SS-4, SS-5, V5–V6).
