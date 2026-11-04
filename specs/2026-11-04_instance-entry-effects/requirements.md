# Phase 10 Instance-entry effects

## Context

Phase 9 calculates base derived values. This phase implements the bounded explicit effects in the [v1 contract](../../data_contracts/contracts.md), guided by the [constitution](../mission.md), [architecture](../tech-stack.md), and [roadmap](../roadmap.md). Existing authored character and monster fixtures provide independent acceptance examples.

## Scope

Include entry/effect validation and framework-independent effect-aware calculation. Port remaining effect acceptance to TypeScript and retire overlapping Python arithmetic tracing after equivalent coverage exists. Exclude UI, persistence, feature catalogs, complete instance validation, creation/edit transactions, and new effect operations.

## Product decisions

The user confirmed this scope on 2026-11-04. Only explicit effects influence calculations; labels, descriptions, category, career, species and role have no mechanical meaning. Reject conflicting effects, including identical factors and effects in the same entry. No automatic stacking or partial success. Existing callers of calculateBase retain base-only behavior.

## Technical requirements

- IE-1: Validate the closed v1 entry and effect shapes, required properties, optional source/metadata, and unique entry IDs. Accept empty entries/effects and duplicate labels. Targets must be declared derived modifier targets. Only multiply with a positive safe-integer factor is allowed; no coercion. Use located diagnostics, including related conflict locations.
- IE-2: Validate all entries/effects before arithmetic. Evaluate each derived base expression in dependency order, apply its matching factor once, then expose its final value to downstream references. Effects add no graph edges. Reuse base expression, input and graph validation.
- IE-3: Enforce finite/safe-number semantics on effect results and normalize negative zero. Recompute independently on every call; preserve caller data and return diagnostics without partial results on failure. State retention remains the caller's responsibility.
- IE-7: As requested during Step 1 review, operation shape validation and arithmetic share a typed registry exhaustive over EntryEffect. Adding an effect type without registered handlers must fail type checking. Supported-operation diagnostics derive from the registry. Only the existing multiply operation is enabled.
- IE-4: Offer an effect-aware domain API accepting a located template, located complete input map and located unknown entry array. Entry-array pointers are relative to that array's document root; callers can supply a logical document label identifying the instance entries. No full-instance validation is implied.

## Accessibility requirements

There is no interface change. Diagnostics must include understandable messages and logical document/JSON Pointer locations suitable for later accessible feedback. Keyboard/focus and sheet presentation requirements belong to later UI phases.

## Completion requirements

- IE-5: Match independent Unnatural Toughness and constructed simultaneous Strength/Toughness examples, downstream propagation and numeric boundaries. Reject malformed entries, invalid targets/factors, conflicts and unsafe results; demonstrate independent recovery and no mutation.
- IE-6: Equivalent TypeScript acceptance replaces overlapping Python arithmetic tracing while retaining independent contract integrity checks. Required automated validation passes and a reproducible human walkthrough is documented; separate human execution is not required, as confirmed by the user.
