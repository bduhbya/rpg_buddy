# Phase 19 requirements

## 1. Context

[Phase 17](../2026-11-10_saved-instance-loading/requirements.md) opens complete snapshots and resolves exact definitions for editing. Phase 19 implements the save side under the [constitution](../tech-stack.md#persistence-and-verification), [roadmap](../roadmap.md), and [data contracts](../../data_contracts/contracts.md#identity-versions-and-library-paths).

## 2. Scope

Provide a main-process API for the selected library. Phase 20 owns the creation interface. Save controls, preload/IPC changes, imports, upgrades, and automatic recovery remain outside this phase.

## 3. Product decisions

Use the canonical role and ID path. Keep one sibling `.json.bak` holding the previous valid revision after an overwrite. Recovery is explicit. An invalid primary must be preserved for recovery, and an unavailable exact definition prevents saving.

## 4. Technical requirements

- **SS-1.** Validate the complete serialized snapshot and resolve its exact archived definitions. Check template compatibility. Preserve the supplied stored results, effects, presentation, and timestamps without recalculating.
- **SS-2.** Resolve the selected library root and use validated identifiers to build the target. Require ordinary, correctly named directories and regular primary and backup files. Create a missing role directory under the verified system directory. Reject nonportable Windows device filenames. Path checks assume no external modification to the directory tree during a save.
- **SS-3.** Hold an exclusive per-sheet lock from target inspection through publication. For a first save, confirm the target is absent under the lock, then publish the flushed and closed temporary file with a same-directory rename. The first-save no-overwrite guarantee applies to RPG Buddy saves, which acquire the same lock. External programs can write without acquiring it. On overwrite, verify that the existing file is a valid predecessor with the same identity, creation time, and definition versions. Publish the exact prior bytes as the backup first, then replace the primary with a same-directory rename. Never unlink the primary to make replacement possible.
- **SS-4.** Preserve a recoverable revision on ordinary write or replacement failure. Use explicit recovery for interrupted saves, including abandoned locks and temporary files. Record correlated checkpoints and a single terminal outcome under `instance.save` using the shared logger. Keep paths, IDs and sheet data out of logs. Return actionable diagnostics and preserve results if logging fails.

## 5. Accessibility requirements

This phase has no interface changes. Typed diagnostics give later interfaces text feedback for failed saves and recovery.

## 6. Completion requirements

- **SS-5.** Both roles round-trip their records without evaluation. Successful overwrite retains the exact predecessor. Validation and write failures leave recoverable data. The recovery walkthrough and repository checks pass and have recorded evidence.
