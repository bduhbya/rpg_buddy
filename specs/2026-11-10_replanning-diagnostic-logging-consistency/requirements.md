# Diagnostic logging consistency replan requirements

## Baseline

Phases 1–17 are complete. Phase 5 established shared diagnostic logging, and [Phase 17](../2026-11-10_saved-instance-loading/requirements.md) completed saved-instance loading. The baseline [roadmap](../roadmap.md) schedules safe saving, the three sheet interface phases, and milestone verification as Phases 18–22.

## Planning requirements

- **R1.** Insert Diagnostic logging consistency as the next phase, Phase 18, after saved-instance loading and before safe saving. Mark it incomplete. Its deliverables are documented logging conventions by code area and consistent coverage across existing workflows under the [logging contract](../tech-stack.md#diagnostic-logging).
- **R2.** Move the five pending phases down one slot in their current order, retaining their deliverables and acceptance criteria. Update active planning references to the new numbers. Preserve completed roadmap rows and historical phase records.
- **R3.** Inventory current workflows and their owning boundaries. Identify missing and inconsistent checkpoints or outcomes, add coverage where the conventions call for it, and record which boundaries already comply or intentionally stay quiet. Reuse the shared logger and align severity, stable reason codes, correlation, and exclusion of user data. Acceptance evidence must cover representative successes and failures from both newly instrumented and corrected workflows, plus a degraded outcome where supported. Verify one outcome record per operation and preserve workflow results if logging fails.
- **R4.** Keep this revision limited to planning documents. Phase 18 will determine the workflow inventory, exact conventions, event-level changes, and verification cases in its own specification. The milestone scope, application behavior and logging contract remain the baseline for that phase.
- **R5.** Document a consistent logging pattern for each code area in maintained repository guidance. State who owns checkpoints and outcomes, how that area obtains the logger and propagates operation context, and when its code should stay quiet. In the domain, use the narrow injectable interface when a domain boundary owns a record and keep pure helpers quiet when a caller can report the outcome. In the main process and renderer, use their existing logging APIs at the boundaries that own the workflow. Cover preload/IPC and shared code explicitly, including how they pass context and avoid duplicate outcomes.
