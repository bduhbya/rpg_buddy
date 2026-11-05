# Requirements

## Context

Phase 12 adds blank-instance creation after runtime definitions. Authoritative sources are [mission](../mission.md), [technology](../tech-stack.md), [roadmap](../roadmap.md), [v1 contracts](../../data_contracts/contracts.md) and [instance schema](../../data_contracts/v1/instance.schema.json). Existing catalog validation and exact dependency resolution remain authoritative.

## Scope

Include a framework-independent domain API and tests. Defer editing/recomputation orchestration to Phase 13, filesystem/loading to Phase 14 onward, and UI to Phase 17. Exclude initial overrides, derived caches, feature selection, full saved-instance validation and application provider wiring.

## Product decisions

- IC-1: Require an exact system/template reference pair and explicit character or monster role. Use template entityType, defaultDisplayName and every input default. Start with empty entries; omit career and development metadata. Neither role changes defaults or calculations. Blank defaults do not assert character legality.
- IC-2: Assign one new stable ID and one UTC timestamp through injected synchronous providers. Set createdAt and modifiedAt to that same timestamp. The ID provider must supply a fresh ID per successful creation; the domain remains stateless and cannot detect collisions across calls or with persisted instances.

## Technical requirements

- IC-3: Accept an unknown closed request containing system, template and role. Validate before resolving via the existing catalog. Invoke providers only after successful request validation and resolution. Return the established discriminated ValidationResult with document/JSON Pointer diagnostics and no partial instance on failure.
- IC-4: Validate provider IDs against the v1 slug format and 64-character bound. Validate real calendar UTC timestamps with seconds, optional fractional seconds and Z, including leap-year/date/time bounds. Convert thrown provider failures into understandable INVALID_VALUE diagnostics without exposing thrown content. Locate ID failures at /id and timestamp failures at /createdAt. Do not retry providers or promise rollback of their external side effects. Providers are trusted callable dependencies; their return values are checked at runtime.
- IC-5: Return independent values, entry arrays and reference objects. Never mutate requests, catalog definitions or previous results; a failed call must not affect subsequent valid creation. Persist source fields only. Calculation graph execution is outside this API; runtime acceptance will demonstrate compatibility with the existing calculation API.

## Accessibility requirements

No interface changes. Diagnostics retain understandable messages and logical document/JSON Pointer locations for later accessible feedback. Keyboard, focus and screen-reader integration belong to the UI phases.

## Completion requirements

- IC-6: Focused creation tests and runtime-definition acceptance demonstrate IC-1 through IC-5; required unit, type, contract and formatting checks pass. The living architecture and reproducible human walkthrough are updated. Separate human execution is not required. Both reviewable steps must be complete before marking the phase complete.
