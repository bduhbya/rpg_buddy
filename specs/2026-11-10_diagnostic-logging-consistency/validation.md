# Phase 18 validation

Run commands from the repository root. Use temporary libraries and disposable Electron profiles for log evidence.

| ID  | Requirements                       | Method and expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| V1  | DL-1, DL-2, DL-3                   | Inspect the guide against current workflow entry points and the logging contract. Verify coverage for all five areas, that the phase inventory identifies the owner and disposition of each workflow, and that wrapper guidance describes failure results and context. Verify new local links, run the Markdown formatter check and `git diff --check`.                                                                                                                                               | Passed |
| V2  | DL-2, DL-3, DL-4, DL-5             | Run `npm run test:unit -- tests/unit/main` against temporary libraries, including the focused IPC cases as they are added. Exercise folder acceptance, cancellation and failed persistence, system acceptance and rejection, supersession, definition-load failure, and saved-sheet editable, rejected and read-only outcomes. Check operation IDs, severities, stable reasons, no duplicate outcomes, no private payload, bounded IPC rejection records, and identical results with a throwing sink. | Passed |
| V3  | DL-2, DL-3, DL-4                   | Run `npm run test:unit -- tests/unit/domain`. Exercise create, edit, equivalent edit, and standalone snapshot validation with injected recorders. Compare success, rejection, and provider exception behavior with and without a throwing sink. Expect unchanged result shape and input preservation, with only the owning operation recording an outcome.                                                                                                                                            | Passed |
| V3a | DL-2, DL-3, DL-4, DL-5, DL-7       | Run the unit suite and the packaged logging spec. Check representative domain success, rejection, provider failure, and unchanged edit. Verify the new fields reach JSON Lines, the console prints event, step, and outcome directly, incomplete field pairs are rejected, and the renderer cannot send structured context until authorized.                                                                                                                                                          | Passed |
| V4  | DL-2, DL-3, DL-4, DL-5             | Run focused renderer and IPC tests and the packaged boundary, logging, and library selection smoke cases. Simulate a local bridge failure and a main-reported rejection. Expect one renderer record for its own failure and no duplicate for the main reply. Exercise authorized renderer workflow, step, outcome, and reason combinations and rejected out-of-contract records. A failed diagnostic transport preserves the renderer fallback and emits no recursive record.                         | Passed |
| V5  | DL-1, DL-3, DL-4, DL-6             | Run the packaged library selection and diagnostics tests with their disposable profiles. Inspect `logs/application.jsonl` before cleanup and capture sanitized examples. Compare temporary-library loader harness records for editable, rejected, and read-only loads. Record the event, step, outcome, severity, reason, and operation grouping for representative newly covered and corrected cases.                                                                                                | Passed |
| V6  | DL-4, DL-5, DL-6 and accessibility | Run the commands in [Windows validation](../../.github/workflows/validation.yml), including format, typecheck, unit, Python contract/type, package, and development and packaged smoke checks. Also run `git diff --check`. Expect passing checks and existing keyboard, focus, and feedback assertions.                                                                                                                                                                                              | Passed |
| V7  | DL-1, DL-6                         | Review the final guide, workflow inventory, and examples and check them against the results above. The user chose to review recorded evidence.                                                                                                                                                                                                                                                                                                                                                        | Passed |

## Workflow coverage

| Area            | Boundaries covered                                                                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain          | Instance creation, editing, and standalone snapshot validation record their results with injected context. Parsing, calculations, catalog internals, and nested validation leave reporting to callers.                                                                      |
| Main process    | Application lifecycle, diagnostics controls, library restore and selection, definition loading, and saved-sheet opening record outcomes. Nested loaders share the caller's operation ID for checkpoints. Routine library views and low-level filesystem helpers stay quiet. |
| Renderer        | Global errors, the support simulation, and renderer-owned application-info and library transport failures use the logging bridge. Main replies and background refreshes leave reporting to their owning boundaries.                                                         |
| Preload and IPC | Main owns bounded application-info, library, and diagnostic IPC rejections. Accepted requests pass to the service. Preload stays quiet.                                                                                                                                     |
| Shared          | Record validation, sanitization, and typed transport are side-effect free.                                                                                                                                                                                                  |

## Evidence

Record actual commands, pass/fail counts, representative records, and any unavailable checks here as each step is validated.

### V1 — Documentation and inventory (2026-11-10)

Compared the guide with the shared contract, domain entry points, main loaders and IPC handlers, and renderer/preload entry points. The guide covers all five areas and records current coverage and disposition for 11 workflow groups. Resolved 41 local Markdown link occurrences across five files, including heading anchors where present. The focused Prettier check and Git whitespace checks for tracked and new files passed. The working tree contains five Markdown changes. Runtime checks V2–V6 and the final evidence review V7 remain pending.

### V2 — Main-process diagnostics (2026-11-10)

- `npm run test:unit -- tests/unit/main` passed 48 tests across three files. The full suite passed all 453 tests after the restore assertions were added. `npm run typecheck` passed.
- Selection tests covered correlated active-loader checkpoints, accepted and rejected selections, supersession, preference restore and write failure, and bounded IPC logging with a throwing sink. For saved sheets, the real logger wrote the expected default-threshold JSON Lines and an injected recorder verified that the exact loader used the same operation IDs for debug checkpoints. A throwing sink preserved editable, read-only, and rejected results.
- `npm run package` built the Windows x64 application. `npm run test:smoke:package -- library-selection.spec.ts logging.spec.ts logging-fatal.spec.ts` passed all 18 tests. The disposable-profile library test verified folder and system records, no warning on picker cancellation, and recovery after invalid definitions. The full smoke suite passed 48 tests with 12 expected development skips. After adding operation-ID assertions to the on-disk records, all five packaged library tests passed again. Startup checkpoint/fatal ID propagation was verified by source inspection. The fatal smoke tests exercised uncaught exceptions and rejections, including drain and nonzero exit.
- Repository-wide formatting and Git whitespace checks passed. Full phase validation remains pending.
- Representative record fields from those checks are grouped below. The operation labels stand in for UUIDs. Other record metadata is omitted.

| Source              | Operation            | Event                         | Level | Reason                       |
| ------------------- | -------------------- | ----------------------------- | ----- | ---------------------------- |
| Packaged library    | Folder choice        | `library.folder.accepted`     | info  |                              |
| Packaged library    | Successful selection | `library.selection.started`   | info  |                              |
| Packaged library    | Successful selection | `library.selection.accepted`  | info  |                              |
| Packaged library    | Rejected selection   | `library.selection.started`   | info  |                              |
| Packaged library    | Rejected selection   | `library.selection.failed`    | warn  | `INVALID_JSON`               |
| Saved-sheet harness | Editable open        | `instance.load.started`       | info  |                              |
| Saved-sheet harness | Editable open        | `instance.snapshot.validated` | info  |                              |
| Saved-sheet harness | Editable open        | `instance.load.opened`        | info  |                              |
| Saved-sheet harness | Read-only open       | `instance.load.started`       | info  |                              |
| Saved-sheet harness | Read-only open       | `instance.snapshot.validated` | info  |                              |
| Saved-sheet harness | Read-only open       | `instance.load.readonly`      | warn  | `DEFINITION_NOT_FOUND`       |
| Saved-sheet harness | Rejected open        | `instance.load.started`       | info  |                              |
| Saved-sheet harness | Rejected open        | `instance.load.failed`        | warn  | `UNSUPPORTED_SCHEMA_VERSION` |

### Step 2 review follow-up

Definition loading, saved-sheet loading, and main IPC handlers now call the main-process wrapper directly. The wrapper handles nested outcome ownership, diagnostic results, and bounded IPC rejections. TypeScript, all 453 unit tests, Windows packaging, 28 targeted packaged smoke tests, formatting, and Git whitespace checks passed.

### V3 — Domain workflow outcomes

The focused domain suite passed 408 tests and the full unit suite passed 456. TypeScript passed. Creation reported success and retained the original diagnostic when the ID provider threw. Equivalent and rejected edits returned the same results with a throwing sink, without mutating the input sheet or consulting the clock. Standalone snapshot validation returned the same located rejection with a throwing sink. The domain dependency check permits only the shared logger type across the boundary and passed.

### V3a — Workflow fields and console format

TypeScript and all 456 unit tests passed. Windows packaging succeeded and all 12 tests in the packaged logging spec passed. Creation, editing, and standalone snapshot validation supply one event name per workflow and identify the step that returned the result. The log service persisted the new fields. The contract rejected malformed or incomplete context, and renderer IPC rejected a structured record pending explicit authorization.

Domain coverage includes all returned results at the create, edit, and standalone snapshot boundaries when the caller injects logging context. Equivalent edits report an unchanged outcome, and provider failures retain their existing diagnostics. Definition resolution, calculation, parsing, and other workflow internals leave reporting to their callers. The desktop has no production creation or editing entry point yet. Saved-sheet opening calls snapshot validation as an internal check, so the main loader owns its records.

The shared contract now accepts workflow-defined outcome labels. The focused logging checks confirmed that a custom outcome persists, while invalid and oversized labels are rejected. TypeScript, all 456 unit tests, and the three focused logging checks passed.

The console now prints event, step, and outcome directly. The focused checks verified the same format for a standard outcome and a workflow-defined outcome. TypeScript and Git whitespace checks passed.

### Step 4 — Main-process record migration

Reran V2 against structured records. All 456 unit tests passed, including the 48 main-process tests. TypeScript and the Windows x64 package build passed. The full Electron smoke suite passed 50 tests, with 12 expected development skips for packaged-only cases. The suite ran with the default startup log level. The menu scenario also exercised debug toggling and correlated trace records.

For example, a saved sheet whose exact definitions are unavailable records event `instance.load`, step `definitions.resolve`, outcome `degraded`, and reason `DEFINITION_NOT_FOUND`. The support simulation uses `diagnostic.simulation` for the main record and still correlates with the renderer record. The renderer producer migration and final phase checks remain pending.

### Step 5 — Renderer records and final checks

- **V4 passed.** The packaged shell showed the same accessible fallback for a valid main `UNAVAILABLE` reply and a missing IPC handler. The renderer recorded the transport exception only. Missing library transport preserved the library feedback and picker focus. Diagnostic transport failure preserved UI feedback. The IPC checks rejected unapproved steps, outcomes, and reasons and preserved sender validation and rate limits.
- **V5 passed.** The packaged smoke suite inspected the isolated profile's JSON Lines before cleanup. The saved-sheet harness also inspected the editable, read-only, and rejected results. The selected fields below represent those checks. Rows with the same saved-sheet label share one operation ID. The two simulation rows share another operation ID. The other rows represent separate operations.
- **V6 passed.** TypeScript, formatting, Git whitespace, all 456 unit tests, all 18 Python contract checks, strict mypy across 11 files, and Windows x64 packaging passed. The development and packaged Electron suite passed 50 tests with 12 expected development skips. The first smoke run found that the startup error matcher mistook the structured `UNCAUGHT_ERROR` reason for an uncaught process error. The matcher now checks the whole word, and the full rerun passed.
- **V7 passed.** Compared the guide and inventory with the final code and checked 19 local Markdown link occurrences across the guide and phase documents. An independent review identified two findings. The follow-up below records both fixes and their checks. The user reviewed and accepted the fixes and authorized closing the phase on 2026-11-10.

| Source                     | Event                   | Step                  | Outcome     | Level | Reason                       |
| -------------------------- | ----------------------- | --------------------- | ----------- | ----- | ---------------------------- |
| Main library selection     | `library.selection`     | `catalog.publish`     | `succeeded` | info  |                              |
| Main library selection     | `library.selection`     | `definitions.load`    | `rejected`  | warn  | `INVALID_JSON`               |
| Editable saved-sheet open  | `instance.load`         | `sheet.open`          | `started`   | info  |                              |
| Editable saved-sheet open  | `instance.load`         | `snapshot.validate`   | `succeeded` | info  |                              |
| Editable saved-sheet open  | `instance.load`         | `sheet.open`          | `succeeded` | info  |                              |
| Read-only saved-sheet open | `instance.load`         | `sheet.open`          | `started`   | info  |                              |
| Read-only saved-sheet open | `instance.load`         | `snapshot.validate`   | `succeeded` | info  |                              |
| Read-only saved-sheet open | `instance.load`         | `definitions.resolve` | `degraded`  | warn  | `DEFINITION_NOT_FOUND`       |
| Rejected saved-sheet open  | `instance.load`         | `sheet.open`          | `started`   | info  |                              |
| Rejected saved-sheet open  | `instance.load`         | `snapshot.validate`   | `rejected`  | warn  | `UNSUPPORTED_SCHEMA_VERSION` |
| Renderer application info  | `application.info`      | `bridge.invoke`       | `failed`    | error | `BRIDGE_UNAVAILABLE`         |
| Renderer library picker    | `library.request`       | `folder.request`      | `failed`    | error | `BRIDGE_UNAVAILABLE`         |
| Renderer simulation        | `diagnostic.simulation` | `renderer.exercise`   | `failed`    | error | `SIMULATED_FAILURE`          |
| Main simulation            | `diagnostic.simulation` | `main.exercise`       | `failed`    | error | `SIMULATED_FAILURE`          |

### Full-phase review follow-up

IPC warnings and errors each have a one-second throttle per handler. The regression reproduced the missing error before the fix. After the fix, a rejected request and a subsequent dispatch error both recorded in the same window, and the second dispatch error in that window remained bounded. The saved-sheet rows above now show all three current operation groups. TypeScript, all 456 unit tests, Windows packaging, 25 affected packaged smoke tests, formatting, and Git whitespace checks passed.
