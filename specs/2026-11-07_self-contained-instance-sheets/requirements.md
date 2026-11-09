# Phase 15 requirements

## Context

[Phase 14](../2026-11-07_instance-editing-and-recomputation/plan.md) edits in-memory source state and returns calculated values separately. The [self-contained instances replan](../2026-11-07_replanning-self-contained-instances/requirements.md) requires complete snapshots before local library persistence. The [technology plan](../tech-stack.md) defines exact dependency resolution and the stored-result lifecycle.

## Scope

Cover the versioned instance contract, schema, authored examples, contract verification and domain creation/editing for both existing roles. Phase 16 handles filesystem definition loading. Phase 17 handles production parsing and validation of saved sheets, including editable versus read-only classification. Saving and UI remain in later phases. V1 conversion, direct result overrides, definition upgrades and rule changes are outside this phase.

## Product decisions

- **SS-1.** A complete sheet holds identity, source values, selected entries with their explicit effects, final results and presentation data. The v2 contract bundle advances all three schema discriminators to 2. Definition revisions remain exact and immutable. The active Rogue Trader definitions use revision `1.0.1`, and the archived `1.0.0` definitions retain schema v1.
- **SS-2.** Source-only v1 cannot be opened as a complete sheet. Report `UNSUPPORTED_SCHEMA_VERSION` at `/schemaVersion`, explain that v1 has no stored final results, and advise retaining the original and recreating the sheet in v2. Normal loading must never recalculate or rewrite a source-only file. Phase 15 verifies this policy in the contract harness. Phase 17 owns the production load diagnostic.

## Technical requirements

- **SS-3.** Persist `derived` as the map of final numeric values by field ID. Persist `presentation.sections` in display order with ordered field IDs, plus `presentation.fields`, a map of nonblank labels with optional nonblank derived units. Every source and result field has one label and one section membership. Field IDs in the two value maps are disjoint. A snapshot needs no definitions to validate its own structure, numeric boundaries, field coverage, timestamps, entry IDs or effect conflicts. An effect must target a stored derived field. Exact definitions additionally establish the expected field sets, presentation, input bounds and allowed effect targets. Stored arithmetic is trusted as recorded after validation.
- **SS-4.** Creation resolves exact definitions, calculates all final values from defaults and empty entries, and snapshots the template's presentation data. Each instance owns its snapshot. If calculation fails, creation returns diagnostics before requesting an ID or timestamp.
- **SS-5.** Edits require exact definitions. Changes to source values or explicit effects by target recompute all final values from the candidate source state. Descriptive changes and equivalent edits preserve stored results and skip evaluation. Validate entry shape and conflicts even when effects are unchanged. An actual successful edit advances the modification time using the existing clock contract. Equivalent edits keep the timestamp and skip the clock. A failure preserves the previous complete snapshot. Normal load, display and save use recorded values without running formulas or applying effects.

## Accessibility requirements

No interface changes are in scope. Persist field and section labels, ordering and applicable units so later interfaces can use the same labeled presentation for both modes. Later UI phases own keyboard behavior, focus and read-only feedback.

## Completion requirements

- **SS-6.** Both role fixtures conform to v2 and pass definition-independent and exact-definition contract checks. Invalid structure, field coverage, numeric values, effect references and source-only v1 fail with actionable evidence. Verification performs no arithmetic.
- **SS-7.** Unit tests and a documented Rogue Trader walkthrough demonstrate initial results, valid edits, effect application exactly once, preservation on failed edits, and no evaluation for descriptive or equivalent edits. Phase checks pass and results are recorded.
