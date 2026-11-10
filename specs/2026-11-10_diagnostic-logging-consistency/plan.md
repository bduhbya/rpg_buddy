# Phase 18 plan

Topic branch `phase/2026-11-10-diagnostic-logging-consistency` from `main` at `30acece95541af0b05c35103d4e81cfa0201ec11`. The starting working tree was clean.

On 2026-11-10, the user confirmed the scope and asked for one reusable logging wrapper in each of the domain, main process, and renderer. Each wrapper can be called directly and returns the area's existing error shape. The user chose to begin the first reviewable step and pause, and to review recorded validation evidence.

- [x] Specify the phase in [requirements](requirements.md) and [validation](validation.md) before implementing it.

## Step 1 — Document conventions and inventory the workflows

- [x] Add [maintained logging guidance](../diagnostic-logging.md) for all five code areas and link it from the [README](../../README.md) (DL-1, DL-2). It defines ownership, wrapper behavior, and how context moves between layers.
- [x] Inventory existing boundaries in the phase validation record (DL-1, DL-3). For each, identify the owner, current coverage, and any planned change or reason for silence. Run V1 and record the evidence.

**Review checkpoint.** Review the guide and confirm the proposed ownership and wrapper behavior before changing runtime code.

## Step 2 — Log main-process library actions and align loader records

- [x] Add the main-process wrapper and use it for library preference restore, folder selection, and system selection (DL-2, DL-3, DL-4). Expected, degraded, and unexpected outcomes produce the appropriate record and preserve the existing result and state.
- [x] Route the active/exact definition loaders and saved-instance loader through that convention. Use a shared operation ID and one terminal outcome when a selection or saved-sheet open invokes a loader. Keep the snapshot validator's standalone call contract (DL-3, DL-4).
- [x] Cover main-owned library IPC failures and align application-info failure severity. Preserve trusted-frame checks and bound rejection logging (DL-4, DL-5).
- [x] Correlate the startup error checkpoint with the fatal outcome when both are recorded. Preserve fatal exit behavior. Run V2 and update the phase coverage inventory (DL-3, DL-4).

- [x] Apply review feedback to call the area wrapper directly in loaders and IPC handlers. Keep ownership and throttling in the area wrapper (DL-2, DL-3, DL-5).

**Review checkpoint.** Review the main-process diff and focused tests before domain instrumentation.

## Step 3 — Add domain workflow logging

- [x] Add the domain wrapper and apply it to standalone snapshot validation and the public create and edit workflows. Use injected logging context when supplied and preserve existing callers, results, and throw behavior (DL-2, DL-3, DL-4).
- [x] Keep inner validation and calculations quiet, and verify success, failure, equivalent edits, and throwing sinks with V3. Update the phase coverage inventory.

- [x] Update the shared contract, persistence, and console formatting. Apply one event per workflow with step and outcome fields to the three domain entry points (DL-7). Run V3a and review the domain coverage.

**Review checkpoint.** Review the structured domain records and coverage before migrating main-process or renderer producers.

## Step 4 — Migrate main-process producers

- [x] Apply the structured format to main-process workflow records. Rerun V2 against the new record shape (DL-7).

**Review checkpoint.** Review the main-process records and evidence before migrating renderer diagnostics.

## Step 5 — Apply the renderer convention and finish validation

- [x] Consolidate renderer logging and the fallback result for local bridge failures. Keep main-owned replies quiet in the renderer. Authorize the exact renderer workflow, step, and outcome combinations through logging IPC and preserve the deliberate simulation pair (DL-2, DL-3, DL-4, DL-5).
- [x] Run V4–V6. Record representative evidence and check the inventory against the final diff (DL-6).
- [x] Record the final review (V7) and mark Phase 18 complete in the roadmap (DL-6).
