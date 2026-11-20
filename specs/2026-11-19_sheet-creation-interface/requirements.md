# Phase 20 requirements

## Context

The [roadmap](../roadmap.md) calls for creating character and monster sheets through the desktop interface. The [domain creator](../../src/domain/instances/create-instance.ts) already resolves exact definitions, applies defaults and calculates initial statistics. The [library selection](../../src/main/library-selection.ts) owns the active validated catalog.

## Scope

Add a main-process workflow, narrow bridge, creation form and minimal preview shared by both roles. Loading, editing, saving and the rulebook-based presentation are later phases.

## Product decisions

The user selects an active template and role, enters a display name, and can accept or replace a readable suggested ID. Generate the suggestion by decomposing the name, dropping diacritics, lowercasing and joining ASCII alphanumeric runs with hyphens. Limit the suggestion to 64 characters, strip trailing hyphens after truncation, and leave the field open for manual entry when no portable suggestion is available. After a manual override, preserve the entered ID while the name changes. Explain collisions and ask for a different ID. The ID stays stable after creation.

## Technical requirements

- **SC-1.** Use only the selected library and exact templates offered by its active system. Main owns the library path and catalog. The desktop form blocks library and system actions for the duration of a creation request through one shared action guard. Reject stale selection requests, including selection replacement during collision checking. Bridge requests must come from the trusted main frame and validate before dispatch.
- **SC-2.** Reject blank names, invalid roles, nonportable IDs and collisions in the same system and role. Compare filenames case-insensitively for portability. Treat existing primary, backup and lock entries as occupied. Track successful IDs in memory for this launch. Use the existing domain creator for defaults and final statistics and return a complete in-memory snapshot with the chosen name (trimmed at the edges) and ID. Creation only inspects the filesystem. It cannot reserve names across processes, so the later save workflow owns final publication and conflict handling.
- **SC-3.** Use the shared logger with the stable `instance.create` event, correlated checkpoints and terminal outcome, and stable reason codes. Exclude paths, user IDs, names and sheet data.

## Accessibility requirements

- **SC-4.** Use associated labels, keyboard-operable form controls, descriptive error feedback and semantic preview headings. Announce status and errors and keep recovery possible after a rejected submission. Show identity, source defaults and stored final statistics from the resulting snapshot.

## Completion requirements

- **SC-5.** Create both roles through the desktop interface, inspect the selected template and resulting identity and values, and verify rejection and keyboard recovery. Pass the required checks in [validation.md](validation.md).
