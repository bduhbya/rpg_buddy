# Phase 6: Domain module foundation - Requirements

## 1. Context

Phases 1–5 are complete. The constitution (`../mission.md`, `../tech-stack.md`, `../roadmap.md`), `../../data_contracts/contracts.md` and `../../data_contracts/v1/*.schema.json` govern this phase. User accepted scope, two review steps and validation on 2026-10-30.

## 2. Scope

- DF-1: Represent the existing v1 manifest, template, expression, instance, entry/effect and diagnostic contracts in a framework-independent TypeScript module under `src/domain/`.
- DF-2: Establish a Vitest harness using the existing system, shared creature template, character and monster JSON fixtures.
- DF-3: Verify the module's dependency boundaries and document how to inspect the contracts and fixtures.

Exclude runtime structural/semantic validation, definition resolution, calculations, effect application, creation/editing services, persistence, feature catalogs and UI changes. These remain later roadmap phases. Do not expand the Python evaluator or retire it before equivalent production calculation coverage exists.

## 3. Product decisions

Preserve v1 JSON property names, required/optional fields, exact definition references, character/monster roles and instance-owned effects. Entity types and entry categories remain open strings. Development metadata is optional and distinct from rulebook citations. No new game rules or library-origin properties.

## 4. Technical requirements

Use literal discriminants for schema version, expression operations, field types, roles and the supported effect operation. Represent all normative diagnostic codes and optional related locations. Types describe document shapes; strings/numbers do not prove ID patterns, valid timestamps, safe integers, uniqueness, bounds or reference integrity. TypeScript is not runtime JSON validation. Untrusted JSON requires later validation before production use.

Domain code must have no React, Electron, filesystem, network or concrete logging backend dependencies. No logging is needed for type declarations. Reuse the existing framework-independent logging interface if later behavior needs it rather than introducing another logger.

The test harness may load authored fixtures through test-only filesystem utilities. Assertions must inspect explicit fixture identities, roles, fields and effects without calculating results or pretending a type assertion validates JSON. Preserve independent expected arithmetic for later engine phases. No unrelated dependency upgrades.

## 5. Accessibility requirements

No interface changes, so keyboard, focus and screen-reader checks are not applicable here. Preserve readable labels, semantic sections, units, source citations and diagnostic location/message fields needed by future accessible interfaces.

## 6. Completion requirements

- DF-1: Domain declarations match all three schemas and the normative expression/effect/diagnostic contracts; strict TypeScript checking passes.
- DF-2: Focused Vitest tests exercise both authored instance roles and their shared definitions; useful compile-time cases cover literal discriminants and optional metadata. Existing Python contract verification remains passing.
- DF-3: Automated boundary checks and inspection establish framework independence; formatting and diff checks pass. Supply a reproducible human code/fixture walkthrough, supplementary rather than a completion gate.

Phase completion requires both review steps and their checks, not just declarations.
