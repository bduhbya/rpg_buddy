# Phase 16 plan

Topic branch `phase/2026-11-09-library-selection-and-definition-loading` from `main` at `1dae3ed3b32589f11de6f7dc46f2987ca4987eaa`. The working tree was clean. On 2026-11-09, the user confirmed a loader-first checkpoint, a library folder remembered in the app profile, system selection on each launch, and a required keyboard walkthrough.

## Step 1 — Read-only definition loader

- [x] Record the behavior and checks in [requirements](requirements.md) and [validation](validation.md) (LL-1 through LL-7).
- [x] Add a [main-process filesystem API](../../src/main/definition-loader.ts) for active system loading and an archived exact-pair lookup. Keep the [canonical library paths](../../src/main/library-paths.ts), file access and UTF-8 decoding in the main process. Apply the [strict JSON contract](../../src/domain/definitions/strict-json.ts) to decoded text before domain validation and resolution. Successful active loading returns a complete catalog for the selected system (LL-2 through LL-4).
- [x] [Exercise the loader](../../tests/unit/main/definition-loader.test.ts) against copied runtime definitions and disposable multi-system libraries. Assert the payload read set and check missing files, invalid inputs, containment, and recovery. Record results (LL-6).

**Review checkpoint.** Step 1 and the deep-formula regression fix were reviewed before Step 2 began. The loader returns an active catalog to its caller or resolves an archived pair on demand. Step 2 will own catalog lifetime and gate application requests to the selected system.

## Step 2 — Library selection and catalog ownership

- [x] Add a native folder picker and remember the validated library folder in the app profile through [main-process selection state](../../src/main/library-selection.ts). Discover system IDs from directory entries without reading definition payloads (LL-1, LL-2).
- [x] Wire selection and diagnostic feedback through the existing trusted Electron boundary and [library panel](../../src/renderer/library-panel.tsx). Scope catalog ownership to the current system and discard stale results on selection changes (LL-2, LL-5).
- [x] Verify restart, cancellation, folder and system changes, and out-of-order completion. Pass automated repository and desktop checks (LL-6, LL-7).
- [ ] Obtain the required human keyboard and screen-reader walkthrough evidence before marking Phase 16 complete (LL-7).
