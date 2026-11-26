# Phase 24 sheet saving interface

- Branch `phase/2026-11-25-sheet-saving-interface`
- Starting base `af96161136a7b09c92a6d732a9218228172f9df0` on `main`
- Pause after the bridge for review. Use automated acceptance evidence and provide a manual walkthrough.

## Step 1 Trusted save bridge

- [x] Resolve destinations in main and expose destination listing and saving for the current editable revision through trusted IPC (SA-1, SA-2).
- [x] Verify authorization, revision and destination checks, persistence, recovery, and diagnostics (V1). Pause for review.

The [save IPC handler](../../src/main/sheet-saving.ts) checks the current editable revision, uses the [destination resolver](../../src/main/sheet-save-destinations.ts), and delegates writes to the [safe saver](../../src/main/instance-saver.ts). The saver compares the editor's last persisted snapshot under its file lock. See [V1](validation.md#v1-save-bridge-sa-1-sa-2) for evidence. Paused for review before Step 2.

## Step 2 Shared sheet controls

- [x] Show Save in the edit toolbar and the library destination below it. Enable the first save and disable repeat saves until there are unsaved edits. Reuse draft submission and provide keyboard-accessible feedback (SA-3, SA-4).
- [x] Verify both roles in packaged Electron, document the manual walkthrough, and update the roadmap on completion (SA-5, V2 and V3).

The [shared sheet page](../../src/renderer/editable-sheet.tsx) lists the authorized library destination and serializes pending edits before dispatching Save. It stays in edit mode and announces the result. Done offers to save, discard, or keep editing when there are unsaved edits. The saver preserves both files when the submitted snapshot is unchanged. The [saved-sheet picker](../../src/renderer/sheet-loading-panel.tsx) refreshes after a successful write. Packaged Electron verification passed and the manual walkthrough is available in the [validation record](validation.md).
