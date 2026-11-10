# Phase 18 requirements

## 1. Context

[Phase 5](../2026-10-29_diagnostic-logging/requirements.md) established the shared logger and local storage. [Phase 16](../2026-11-09_library-selection-and-definition-loading/requirements.md) and [Phase 17](../2026-11-10_saved-instance-loading/requirements.md) added library and instance loading. Those workflows have uneven diagnostic coverage and use different local logging patterns. Follow the [logging contract](../tech-stack.md#diagnostic-logging), [Phase 18 roadmap](../roadmap.md), [replan handoff](../2026-11-10_replanning-diagnostic-logging-consistency/requirements.md), and [repository instructions](../../AGENTS.md).

## 2. Scope

Document conventions for domain, main process, renderer, preload/IPC, and shared code. Inventory current workflow boundaries and correct missing or inconsistent coverage, starting with library selection, instance creation and editing, active/exact definition loading, and saved-sheet opening. Include renderer-owned bridge failures, main-owned library IPC rejection paths, and targeted alignment of application-info and startup records. Existing compliant areas can retain their implementation. Safe saving is Phase 19. Telemetry, log viewers, storage or retention changes, and new sheet UI are outside this phase.

## 3. Product decisions

The user confirmed the coverage and requested a common, directly callable wrapper in each of the domain, main process, and renderer. Logging continues to use the shared service and local diagnostics. Existing workflow behavior, result contracts, user feedback, and log storage remain the baseline. Cancellation and supersession are ordinary control flow and carry no warning by themselves. The user chose to review recorded evidence.

## 4. Technical requirements

- **DL-1.** Maintain a linked guide that identifies what each code area records, how it obtains its logger and operation context, and when it stays quiet. Record workflow coverage and ownership in the phase validation record. Keep workflow-specific event details at the call sites.
- **DL-2.** Provide one reusable wrapper per domain, main process, and renderer area. Workflows call their area wrapper directly on failure paths to record a diagnostic and return the existing typed failure or fallback. Configure the area wrapper with the operation context instead of adding workflow-specific logging wrappers. Preserve diagnostic identity and detail in the return value. Centralize best-effort recording and repeatable result handling within each area. Use the injected shared interface in domain and main, and the existing validated bridge in renderer. Leave the domain free of Electron, filesystem, and concrete logger dependencies. Existing callers can omit domain logging context.
- **DL-3.** Give each operation one terminal outcome at the boundary that owns its result. When library selection or saved-sheet opening invokes a child loader or validator, use the same operation ID for useful checkpoints and let the outer boundary record the final result. Standalone workflows retain ownership of their own outcomes. Keep pure helpers quiet, including calculations and leaf validation when a caller owns the result. Keep main-owned IPC replies quiet in the renderer. A renderer workflow can opt in to a sanitized transport exception when its bridge call cannot obtain a valid reply, then record it and return the existing typed fallback. Preserve the support simulation's deliberately correlated main and renderer records.
- **DL-4.** Use stable dotted event names. Use info for meaningful checkpoints and useful success, warn for expected rejection or degradation, error for unexpected failures, and debug for detail. Failure records use a stable code. Keep paths, system and instance IDs, document labels, pointers, messages, and sheet contents out of records. Preserve successful, failed, and degraded results, including any preexisting thrown errors, if logging fails.
- **DL-7.** Give each workflow one event name. Supply a stable dotted `step` and a workflow-defined `outcome` together on each migrated record. Store those fields in JSON Lines and print the event, step, and outcome directly in the development console. The contract continues accepting existing records with neither field during migration. The renderer endpoint accepts structured fields only after it explicitly authorizes the workflow, step, and outcome. Apply the format first to domain creation, editing, and standalone snapshot validation, then review that slice before migrating other producers.
- **DL-5.** Keep preload a typed transport and IPC authorization narrow. Preserve sender, frame, request, and response checks and bound rejection logging. A rejected or unavailable logging request keeps its existing response and cannot trigger recursive logging. Shared code defines the record and transport contract.

## 5. Accessibility requirements

No UI changes are in scope. Preserve keyboard operation, picker focus restoration, control labels, status and alert behavior, and existing error text. Exercise the library and diagnostics flows in the existing desktop tests.

## 6. Completion requirements

- **DL-6.** The guide and implemented workflow inventory agree. Focused tests and representative sanitized JSON Lines show successful and failed outcomes for newly covered and corrected workflows, plus a saved-sheet read-only outcome. Evidence demonstrates severity, stable reasons, correlation, single outcome ownership, privacy, and preservation of results when logging fails. The repository's Windows validation checks pass and the user can review the examples and evidence in [validation](validation.md).
