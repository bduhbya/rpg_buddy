# Phase 17 requirements

## Context

[Phase 15](../2026-11-07_self-contained-instance-sheets/requirements.md) established the v2 self-contained sheet contract. [Phase 16](../2026-11-09_library-selection-and-definition-loading/requirements.md) added main-process library selection and exact archived definition lookup. The [data contracts](../../data_contracts/contracts.md) and [technology plan](../tech-stack.md) govern the storage format and lifecycle.

## Scope

Validate and open existing character and monster sheets from the selected library. Determine editing availability from the exact referenced definitions. Phase 18 owns saving and recovery, and Phase 21 owns the desktop save/load controls. File discovery, import, conversion, upgrades and editing workflows are outside Phase 17.

## Product decisions

- **SL-1.** Preserve stored identity, values, final results, presentation, entries and timestamps on open. Opening performs no formula evaluation, effect application or file writes. A source-only v1 sheet fails with `UNSUPPORTED_SCHEMA_VERSION` at `/schemaVersion`. Explain that it lacks stored final results and advise keeping the original and recreating the sheet in v2.

## Technical requirements

- **SL-2.** Validate parsed v2 snapshots in the framework-independent domain. Enforce the closed schema, real ordered UTC timestamps, numeric bounds, disjoint value maps, exactly one label and one section membership per stored field, unique section and entry IDs, derived-only units, and valid effects targeting stored derived fields without conflicts. Return logical document labels and JSON Pointers for failures.
- **SL-3.** Accept a library root and a system ID, instance role and stable instance ID at the main-process boundary. Resolve the canonical `RPG_systems/<system-id>/{characters,monsters}/<instance-id>.json` path with the same containment, link and casing checks used for definitions. Read strict UTF-8 JSON and reject invalid documents or mismatches between path identity and sheet identity before definition lookup.
- **SL-4.** Resolve the recorded system and template revisions through the exact archived lookup. With resolved definitions, check references, entity type, field sets, input bounds, ordered presentation, and allowed effect targets. A conflicting sheet fails. If the exact definitions cannot be loaded, return the independently valid sheet in read-only mode with the dependency diagnostics. The loader does not substitute active or newer revisions.

- **SL-6.** Record saved-sheet load checkpoints and outcomes using the existing main-process logger. Use info for `instance.load.started`, `instance.snapshot.validated`, and `instance.load.opened`, and warn for `instance.load.failed`, `instance.load.readonly`, or `instance.snapshot.invalid` with the relevant diagnostic code. Correlate events for the load. Keep paths and sheet data out of records and preserve the load result if logging fails. The snapshot validator records its own outcome through an injected shared logger and uses the caller's operation ID. The loader uses the validator's rejection event as the failure record for invalid snapshots.

## Accessibility requirements

Phase 17 introduces no interface controls. Preserve the snapshot's ordered sections, field labels and units in both modes. Supply readable, located diagnostics that Phase 21 can surface to explain read-only mode and invalid files.

## Completion requirements

- **SL-5.** Open both roles with their recorded results intact and demonstrate exact archived lookup and the read-only fallback. Reject malformed, incompatible and source-only sheets. Verify source bytes remain unchanged and opening does not evaluate formulas or apply effects. Record automated, logging, and disposable-library walkthrough results in [validation](validation.md).
