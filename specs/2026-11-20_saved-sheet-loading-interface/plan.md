# Phase 21 sheet loading interface

- Branch `phase/2026-11-20-saved-sheet-loading-interface`
- Starting base `8bc61fcdc425429a0ec6b5a750148171844b5eb0` on `main`
- The user approved a review between the two steps.

## Step 1 Main-process workflow and bridge

- [x] List saved sheet IDs by role under the selected system and open a selected ID through the existing loader (SLI-1–SLI-3).
- [x] Wire the typed bridge and verify request validation, selection changes, and diagnostic logging (SLI-3, SLI-4).

Step 1 is ready for human review. The [workflow](../../src/main/sheet-loading-workflow.ts) scopes listing and opening to the selected library and system. The [IPC handler](../../src/main/sheet-loading-ipc.ts) checks the trusted frame and the request before dispatch. See the [validation evidence](validation.md#step-1-evidence).

## Step 2 Desktop controls

- [x] Apply review feedback by correlating loader events and locking selection in main during opening. The user chose to leave the replacement-junction behavior unchanged.

- [x] Add role and sheet selectors, open action, snapshot preview and accessible feedback (SLI-1, SLI-2, SLI-5).
- [x] Run automated checks and the disposable-library desktop walkthrough. Record results and mark the roadmap entry complete once acceptance checks pass (SLI-6).

The [open form](../../src/renderer/sheet-loading-panel.tsx) uses the [shared action guard](../../src/renderer/library-panel.tsx), and main holds a [selection lock](../../src/main/library-selection.ts) while opening. Both creation and loading use the same [snapshot preview](../../src/renderer/sheet-preview.tsx).

Phase 21 is complete. See the [Step 2 evidence](validation.md#step-2-evidence).
