# Phase 23 sheet editing interface

- Branch `phase/2026-11-24-sheet-editing-interface`
- Starting base `7c363618f9934aad5dbc7dc504e20a21b742e2d6` on `main`
- The user requested a review after the bridge and a repeatable walkthrough alongside automated evidence.

## Step 1 Edit bridge

- [x] Issue main-owned edit handles on creation and editable opening, and expose one atomic edit operation through trusted IPC (SE-2, SE-3).
- [x] Verify authorization, payload validation, revision conflicts, recomputation, recovery, and logging (V1).

The [main edit workflow and IPC handler](../../src/main/sheet-editing.ts) retain the valid snapshot and exact definitions. The [preload bridge](../../src/preload/preload.ts) submits one operation and returns a fresh snapshot and revision on success. The [validation record](validation.md#v1-edit-bridge-se-2-se-3) contains the automated evidence. Paused for review before Step 2.

## Step 2 Shared sheet controls

- [x] Add Edit and Done controls and use the existing Rogue Trader component for both modes. Keep per-field and per-entry Apply actions in the shared layout. Have Done submit remaining drafts through a flow Phase 24 can reuse before saving (SE-1, SE-4, SE-6).
- [x] Verify both roles and workflows in packaged Electron, provide the manual walkthrough, and update the roadmap after completing the phase (V2, V3).

The [sheet page](../../src/renderer/editable-sheet.tsx) owns drafts and processes them serially. The [Rogue Trader presentation](../../src/renderer/rogue-trader-sheet.tsx) retains field order and renders [draft controls](../../src/renderer/sheet-edit-controls.tsx) in place. Creation and loading retain accepted revisions when returning to the main page. Automated validation passed. The manual walkthrough is available for the user's review.

## Edit bar revision

- [x] Replace field and entry Apply actions with a sticky sheet-level edit bar. Route Apply edits and Done through the same submission flow, support discarding drafts in place, and stage entry removals with the other drafts (SE-7).

## Rulebook entry revision

- [x] Replace entry authoring on the sheet with [rulebook trait selections](../../src/shared/rogue-trader-rulebook-entries.ts). Resolve selections in main and retain staged removal for existing entries (SE-8).
- [x] Replace the checklist with a searchable entry dropdown and catalog-defined category filter. Keep selections staged until a sheet-level action applies or discards them (SE-9).
