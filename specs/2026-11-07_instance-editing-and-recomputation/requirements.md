# Phase 14 requirements

## Context

Phase 12 introduced in-memory creation. The domain can resolve exact definitions and calculate derived values with entries, but callers have no domain operation that validates and recomputes a proposed edit as one unit. The [mission](../mission.md), [technology boundaries](../tech-stack.md), [roadmap](../roadmap.md), and [v1 contract](../../data_contracts/contracts.md) govern this phase.

## Scope

This phase covers the framework-independent editing API for valid in-memory instances. Library and definition loading, validation of parsed saved instances, persistence, and the sheet interface belong to later phases. Feature-library selection, definition upgrades, role or identity changes, new game mechanics, and direct derived-value overrides are outside scope.

## Product decisions

- **IR-1.** Set one template-defined source value, the display name, or the optional career per call. Use `null` with `set-career` to remove career. Display name and any supplied career text must be nonblank. Store accepted text as supplied.
- **IR-2.** Add, replace, or remove one instance-owned entry snapshot per call. Add and replace take a complete snapshot as JSON text. Add appends it with a new local ID. Replace uses the ID in the snapshot to replace an existing entry in place. Remove takes an existing local ID. Duplicate adds and unknown IDs for replace or remove fail. The engine applies explicitly declared effects under the existing target and conflict rules.
- **IR-3.** Apply each operation atomically. A successful edit returns its instance and complete recalculated results. A failure leaves the prior source state and results available. Multiple operations require separate calls and each successful result becomes the input to the next. An equivalent edit recomputes and retains the current modification timestamp. Equivalent entry replacements ignore object key order and preserve array order.

## Technical requirements

- **IR-4.** Accept a previously valid in-memory instance and exactly one runtime-validated operation with primitive arguments. Add and replace parse entry JSON into private data and reject malformed text and duplicate object keys. Validate and calculate from the same private candidate returned on success. Resolve the instance's exact references and reuse the effect-aware engine for source values, entries, and calculations. Preserve identity, role, entity type, exact references, creation time, and instance metadata. Keep derived results separate from source data.
- **IR-5.** Return independent source data and derived results. A rejected edit returns only located diagnostics and leaves the input instance and previously returned results intact. Preserve engine diagnostic locations and related locations. Use understandable feedback for malformed edits.
- **IR-6.** For an actual change, read the injected UTC clock once after successful calculation. Reject invalid or earlier timestamps and report clock failures at `/modifiedAt`. Equal times are valid at the clock's resolution. Failed or equivalent edits leave the input modification timestamp intact.

## Accessibility requirements

There is no interface change. Diagnostics must include readable messages and locations that a later sheet interface can associate with inputs or entries. Keyboard and focus behavior belong to the sheet interface phase.

## Completion requirements

- **IR-7.** Automated tests demonstrate source and entry edits, exact resolution, effect-aware recomputation, preservation of an independent instance, and recovery after invalid edits. Unit, type, contract, formatting and whitespace checks pass. The living architecture guide and reproducible walkthrough describe the final workflow.
