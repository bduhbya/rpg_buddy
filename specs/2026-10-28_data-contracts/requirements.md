# Phase 2: Data contracts - Requirements

## 1. Context

The constitution (`../mission.md`, `../tech-stack.md`, `../roadmap.md`) and approved Phase 1 `../2026-10-28_source-review-scope/source-review.md` are authoritative. This phase supplies portable data contracts, not a running application.

## 2. Scope

DC-1: Define structural schemas for system manifests, templates and saved instances.
DC-2: Define stable identity, exact version resolution and library paths.
DC-3: Define a closed expression tree and numeric/dependency semantics.
DC-4: Define actionable diagnostics and failure preservation.
DC-5: Supply one shared creature template and character/monster instances matching the approved calculation slice.
DC-6: Provide reproducible structural and semantic contract checks and review evidence.

DC-7: Separate template entity type from instance role; persist free-form career and selected entries without enforcing rulebook prerequisites or complete character legality.
DC-8: Define explicit instance-owned, generic multiply effects on template-declared derived targets; validate conflicts and recompute without modifying the template.

Exclude future mechanics beyond these explicit effects, shared-rules documents, automatic migration, persistence code and application UI. Phase 4 implements definition validation, Phase 5 evaluation, Phase 6 production system content, and Phase 8 persistence; these examples are fixtures for those phases.

## 3. Product decisions

User confirmed JSON Schema 2020-12 and the Phase 2 defaults. Use exact three-part nonnegative numeric definition versions, initially `1.0.0`, without ranges or prereleases; schema version is integer `1`. Stable lowercase ASCII IDs use letters/digits and internal hyphens, at most 64 characters. Names are required nonblank text; duplicates are allowed. Examples are explicitly demonstration data, not complete legal characters. Source metadata identifies the approved book without copying it.

The user confirmed that descriptive template IDs identify the template and the definition filename is always `template.json`. The display label remains separate. The shared base creature template uses defaultDisplayName `Creature`, independent of the named demonstration instances. Multiple templates and versions share this convention; ships and planetary systems remain future entity kinds.

User-authorized revision: characters and monsters share a creature template; entityType describes the structure and role describes an instance's library/workflow use. Career/class and selected skills, talents, traits and custom entries are user-controlled text, with no catalog or legality gate. Only explicitly encoded supported effects participate in calculations. A description alone has no automatic mechanical effect. The Ork's Unnatural Toughness entry carries a multiply-by-2 effect on toughnessBonus. Generic Unnatural Strength can target strengthBonus on the same template regardless of role. Initial roles remain character/monster; other entity types, role workflows and encounter copies are later phases.

## 4. Technical requirements

The normative `../../data_contracts/contracts.md` defines cross-document behavior beyond JSON Schema. Schemas reject unknown properties at every object boundary. Numeric field defaults and instance values are finite integers; template constraints determine admissible ranges. The v1 supported field types are integer editable inputs and numeric derived outputs. Ordered section/field arrays define presentation. Names are top-level instance metadata, not calculation fields. Required timestamps are real calendar UTC ISO 8601 timestamps with seconds and optional fractional seconds, ending in Z; createdAt must not exceed modifiedAt.

Definitions, references and storage paths resolve exactly; no newest-version fallback, automatic rewriting or filename identity. Save editable inputs only; recompute derived outputs. Schemas perform structure checks; later runtime validators must additionally enforce all semantic invariants in ../../data_contracts/contracts.md. Diagnostics include code, document, JSON Pointer, message and optional related pointers. Failed edits/loads preserve the last valid state and source files.

Features are editable source data, not derived-value overrides: each selected entry has a stable ID, category, label, description, optional documentary source and zero or more explicit effects. Effects reference allowlisted derived targets and positive safe-integer factors. Evaluate the template base formula first, then its single applicable effect; dependencies see the final result. Zero effects means identity. Conflicting effects on the same target are rejected with clear feedback; do not invent stacking rules. Free-form entries remain valid with an empty effects array. No effect expression, prose execution, career prerequisites or GM online approval workflow is introduced. Duplicate selected-entry IDs are invalid; duplicate labels are allowed. All nine base creature attribute defaults are 0. These are blank-sheet initialization values, not claims of legal/generated creature statistics. Creation uses template defaults; different character/monster demonstration values belong in the instances.

## 5. Accessibility requirements

No UI changes. Templates carry readable labels, section labels and movement units; field order is explicit. Future UI must use accessible labels and keyboard interaction, distinguish calculated values as read-only, and associate plain-language diagnostics with fields. The examples must be understandable without color.

## 6. Completion requirements

- DC-1/2: Three valid schemas, specified identity/version/path rules, and no unresolved references in examples.
- DC-3/4: Closed operator signatures, finite arithmetic, dependency rules and diagnostic/failure behavior documented.
- DC-5: The shared creature template and both example instances preserve nine inputs, seven outputs and the C1/M1 values; Ork TB x2 is an instance trait effect.
- DC-6: Reproducible schema checks, negative cases, independent expected arithmetic comparisons and consistency inspection pass; human walkthrough supplied. Human execution is supplementary and is not a completion gate.

- DC-7: Both instances resolve the same creature template, retain distinct roles and selections, and permit descriptive homebrew without mechanical effects.
- DC-8: Bonus multiplication is applied after floor, is role/name-independent, can be added/removed without mutation, and rejects invalid/undeclared/conflicting effects. Unnatural Strength and Toughness can coexist on different targets.

## Documentary provenance clarification - 2026-10-29

Rulebook citations belong in source/sourceRefs and must be understandable without a development phase register. Development provenance belongs only in optional metadata: sourceReview, requirementRefs and sourceRegisterRefs. These documentary strings never resolve calculation dependencies, execute, fetch or require phase files to load an instance/template. Metadata is optional on templates, input/derived field definitions, instances and selected entries. Closed metadata structure and nonblank references remain validated when supplied. Remove the required top-level template sourceReview field; existing draft fixtures are updated in place.

## Feature-library pattern clarification - 2026-10-29

Templates expose generic derived-statistic modifier targets without enumerating feature identities. Reusable choices belong in a separate system-specific feature library. Selection must copy an independent entry/effect snapshot into an instance; existing entries do not depend on a live library and custom entries require no library origin. Exact definition identity/version provenance is distinct from instance-local entry identity and optional development metadata. Library updates must not rewrite selected snapshots automatically. The current template/entry schemas already support generic targets and self-contained effects; feature-definition/catalog/origin contracts and selection/update workflows are explicitly deferred until their own bounded phase. No unknown fields are added to current examples.

## Verifier maintenance requirements - 2026-10-29

Keep `python data_contracts/verify_contracts.py`, `ContractTests.test_zero_defaults` and existing VS Code task/launch paths working. Organize verification-only helpers, typed document shapes, semantic checks, bounded expression traces and focused tests into readable modules. Add parameter/return annotations and meaningful TypedDict/Literal contracts; confine Any to untrusted JSON/schema input and deliberately malformed test data. Preserve all 22 current test methods and their scenarios. A static checker must pass for the maintained verifier package. Document that Python checks file contracts and fixture arithmetic only; future production TypeScript behavior must be tested using the same acceptance cases, not maintained as a competing Python engine.
