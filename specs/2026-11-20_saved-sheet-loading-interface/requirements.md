# Phase 21 requirements

## Context

The [roadmap](../roadmap.md) connects the [saved-sheet loader](../../src/main/instance-loader.ts) to the desktop. The [technology plan](../tech-stack.md) governs IPC and persistence. Phase 20 established a library selection workflow and a minimal snapshot preview.

## Scope

Open prepared character and monster sheets in the selected system. Shared Rogue Trader presentation, editing, saving, import, and migration belong outside this phase.

## Product decisions

- **SLI-1.** Choose a role and pick a saved sheet from a list. Show readable display names alongside stable IDs from canonical primary filenames. Use the ID alone when the name cannot be read. An absent role directory yields an empty list. Validate each document when opened so a malformed file can be selected and explained.
- **SLI-2.** Present the validated snapshot with its recorded statistics. Explain read-only mode when exact definitions cannot be resolved. Show actionable diagnostics for rejected files.

## Technical requirements

- **SLI-3.** Main owns the root and active system. Scope enumeration to ordinary canonical role directories and primary JSON files. Use the existing loader for validation and exact definition resolution. Reject stale requests and discard results when the selection changes during an operation. Use a typed bridge restricted to the trusted main frame with closed, runtime-validated payloads. Opening performs no recalculation or writes. Main rejects competing opens and library or system changes while a sheet is opening. An in-flight folder picker also prevents opening until it settles.
- **SLI-4.** Reuse the shared logger and existing `instance.load` records for loader outcomes. Record listing, boundary rejections, and stale-selection outcomes with stable steps and reason codes. Correlate the workflow and loader with the same operation ID. Exclude paths and user data.

## Accessibility requirements

- **SLI-5.** Use associated labels, keyboard-operable controls, semantic preview headings, and announced status and diagnostic feedback. Announce listing and opening progress through the shared action guard and disable conflicting controls until it settles. Allow the user to recover from a rejected open.

## Completion requirements

- **SLI-6.** Open both roles in a disposable library, inspect recorded values and read-only and invalid-sheet feedback, verify unchanged files and logging, and complete the checks in [validation.md](validation.md).
