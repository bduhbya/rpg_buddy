# Data contracts

The [v2 contract bundle](v2/) contains a complete set of system, template and instance schemas. All documents in the supported bundle declare `schemaVersion: 2`. The [versioning policy and change history](README.md#versioning-and-change-history) record changes and retirement decisions.

All JSON is UTF-8. Reject duplicate object keys, non-JSON tokens such as NaN/Infinity, unknown properties and unsupported schema versions before using a document. JSON Schema describes structure. The semantic checks below are also mandatory. Object key order is insignificant. Array order is meaningful. No string-to-number or boolean coercion.

The [Phase 15 specification](../specs/2026-11-07_self-contained-instance-sheets/requirements.md) records the instance v2 transition. The v1 schemas and examples were retired before release and remain available in Git history.

## Identity, versions and library paths

IDs are stable lowercase ASCII slugs (1-64 characters); field IDs are case-sensitive ASCII identifiers as defined by the schema. Identity never comes from a label or filename. The same entity ID remains stable across saves. New instances receive fresh IDs, with collision detection; fixture IDs are not an ID-generation policy. All references use exact id/version pairs. Definition revisions use `major.minor.patch` with no leading zeros. Changes to a published definition, including its `schemaVersion`, require a new definition revision. An instance may reference an older supported definition by its exact revision. No ranges, implicit upgrades or newest-version fallback. Unsupported versions fail without rewriting files.

Template IDs carry the descriptive identity (for example, `creature-core`). Every template definition file is named exactly `template.json`; do not encode its identity in a custom filename. The template's `label` remains its human-readable display name and may change independently of the stable ID. The templates directory supports many distinct templates, each with its own version history. Future descriptive IDs could include `voidship` or `planetary-system`; these require separately specified entity kinds and instance storage contracts before use, since the initial storage/workflow roles support only characters and monsters. entityType is a descriptive stable slug rather than a closed species/class list; additional entity types still require their own specified templates and storage/workflow policy.

Canonical paths relative to a user-selected library root:

```text
RPG_systems/<system-id>/system.json
RPG_systems/<system-id>/manifests/<system-version>/system.json
RPG_systems/<system-id>/templates/<template-id>/<template-version>/template.json
RPG_systems/<system-id>/characters/<instance-id>.json
RPG_systems/<system-id>/monsters/<instance-id>.json
```

`system.json` is the active manifest for discovery; an identical immutable copy is retained under manifests at its declared version. Existing instances resolve the archived exact manifest and template, even when the active manifest changes. Every published manifest/template id-version pair is immutable; conflicting contents for the same pair are an error. The active manifest can move to another version only after its archive and definitions exist. Each template appears once in a manifest, identified by its exact pair; multiple versions of an ID may be listed. An instance template must occur in its exact system manifest, and template.system must equal instance.system. Its entityType must equal the template entityType. role belongs only to the instance and must not select a different template or calculation path. Verify file identity agrees with its canonical path; no supplied path strings are dereferenced. Implementations must keep resolved paths inside the configured root, including symlink/reparse-point checks in the persistence phase.

To map the `examples/v2/` fixture bundle into a library, copy its `system.json` to the active and archived manifest paths, each template to its exact template path, and each complete sheet to its role-specific path (character -> characters, monster -> monsters). Changing roles must not change arithmetic. Filesystem relocation and collision handling will be specified before persistence implementation. The constitution reserves a rules directory. Adding shared definitions requires an explicit later contract version and resolver. Current formulas stay in their templates.

## Manifest, template and instance semantics

A manifest declares source identity and available template pairs. Source fingerprint identifies the reviewed local PDF, not a runtime file to load. source/sourceRefs contain direct rulebook citations: publication identity, printed page numbers and relevant heading/table. Readers must not need a development phase register to understand the citation. For example, the Ork entry cites Rogue Trader Core Rulebook (2009, RT01, Print ID 01), printed pp. 368 and 377.

Development provenance is optional metadata, separate from rulebook source fields. Templates, input/derived definitions, instances and selected entries may have a metadata object with optional sourceReview (nonblank string), requirementRefs (array of nonblank strings), and sourceRegisterRefs (array of nonblank strings). Unknown metadata properties are rejected; empty objects/arrays are allowed. sourceReview identifies a development review document, requirementRefs records requirement/document identifiers, and sourceRegisterRefs preserves labels such as S6/S7. These values are documentary only; they are never loaded as rules, resolved as dependencies, fetched or executed. Omitting metadata must not prevent loading or change calculations. No top-level sourceReview property is required or supported in the revised template draft.

Template input and derived IDs must be unique across both arrays. Inputs are editable integers with inclusive minimum/maximum; minimum <= maximum and default is within bounds. The generic schema does not impose Rogue Trader ranges; the example template imposes 0-99. Exactly one section membership is required for every field, with no unknown or repeated fields; section IDs are unique. Ordered sections and their fields define UI ordering. Derived expressions must produce numbers. Derived unit is optional; bonuses are dimensionless, movement is metres/round. Default names and labels must be nonblank. The shared base template uses defaultDisplayName `Creature`; it defines the supported structure for any creature using this sheet, independently of specific example instances. It currently covers the agreed core-statistics slice, not every creature mechanic. modifierTargets is a unique array of derived field IDs which accept explicit instance effects; unknown IDs and input field IDs are invalid targets. An empty array disables effects. The shared example allows only strengthBonus and toughnessBonus; its seven derived formulas contain no species, class or role tests.

Instances require exactly the template input keys, with values satisfying each input constraint. `displayName` is editable, nonblank, and independent of field expressions. Names need not be unique. Persist optional career text and required entries (empty array permitted) alongside editable values. All nine base creature attribute defaults are 0, representing an unfilled sheet. The two example instances supply their own distinct Phase 1 C1/M1 values and names. Timestamps are valid calendar UTC times ending in Z, with `createdAt <= modifiedAt`. Creation assigns both times. Successful changes update `modifiedAt` with the caller's UTC clock, which must return a time at or after the previous modification time. Equivalent edits keep the timestamp. Failed edits and saves preserve the prior state.

### Complete instance sheets (v2)

- `values` maps editable field IDs to safe integers. `derived` maps derived field IDs to all final numbers, with applicable modifiers already included. Both maps require at least one field, and their keys are disjoint. Derived values obey the finite binary64 and safe-integer rules below. Direct derived-value overrides are outside the contract.
- `presentation.sections` copies template sections in order. Each contains its ID, nonblank label and ordered list of field IDs. Section IDs are unique, and every key in the two maps occurs in exactly one section. `presentation.fields` maps exactly those keys to objects with a nonblank `label` and an optional nonblank `unit` for a derived field. A renderer identifies editable and derived fields by the map holding the value. The snapshot uses labels and units from the exact template. Formula definitions, editable bounds and allowed effect targets belong to the template.
- Validate snapshot shape, timestamps, internal field coverage, finite/safe numbers, and entry/effect shape and uniqueness without definitions. Each effect target must occur in `derived`. With exact definitions, also verify identity and membership, the input and derived field sets, input bounds, ordered presentation and allowed effect targets. Neither level validates the arithmetic by running formulas. A valid snapshot can carry a recorded value that differs from the current evaluation of the same source state.
- Creation computes final results from defaults. An edit changing editable values or the set of explicit effects by target calculates from the candidate inputs and effects, then publishes the complete updated instance together. Descriptive and equivalent edits preserve the recorded results without evaluating formulas. Validate changed entry snapshots even if their effects are identical. Opening, displaying and saving use the recorded results. With unavailable exact definitions, a valid saved sheet opens read-only with the missing dependency identified and editing and saving disabled. Invalid snapshots fail. Opening never rewrites the original file.
- Source-only instance v1 is unsupported for opening a complete sheet. Report `UNSUPPORTED_SCHEMA_VERSION` at `/schemaVersion` and explain that v1 lacks stored final results. Advise the user to keep the original and recreate the sheet in v2. There is no automatic or explicit v1 conversion in this phase.

## Instance role and user-directed selections

entityType describes sheet structure (`creature` in the example), not allegiance, species, career or library category. role is `character` or `monster` for the initial workflows. Both instances reference the same exact creature-core template. A saved monster is an individual library instance, not a template for every monster. Future encounter placement creates an independent instance with provenance; encounter implementation is deferred.

career is optional nonblank free-form career/class text. entries is an ordered array of user-chosen selections. Each entry has a unique stable slug id, category slug (for example skill, talent, feat, trait or custom), nonblank label, description string (may be empty), optional nonblank rulebook source, optional development metadata, and required effects array. Categories and labels are not rules identifiers; duplicate labels are allowed. No canonical career list, prerequisites, complete rulebook catalog, character legality gate or online GM approval is required. Users and GMs may choose homebrew entries. Descriptions and sources never execute or fetch external content. Removing an entry removes its effects on recomputation.

### Feature library and instance snapshots

The template declares calculation structure and generic extension points, not a catalog of selectable skills, talents or traits. modifierTargets lists derived field IDs which may receive supported effects; it neither creates an effect nor declares that every possible operation is supported. The current operation remains multiply, and the current template permits strengthBonus and toughnessBonus only. No template list of Unnatural Strength, Unnatural Toughness or other feature IDs is needed.

Reusable feature choices belong to a separate, system-specific feature library. When selection is implemented, adding a feature must create an independent instance entry snapshot containing its label, category, description, rulebook source when present, and explicit supported effects. Each selected entry gets its own instance-local ID. Feature definition identity and exact version are provenance for that selection, separate from both that local entry ID and optional development metadata. No engine behavior may depend on a feature's label or library identity.

The saved snapshot is authoritative for that instance. Library edits/deletion or a missing library must not silently change or invalidate existing selected entries. Updating a selection from a newer library version must be an explicit user action with validation before replacement; automatic updates and live references are excluded. Custom entries use the same shape and must remain possible without any library origin. Validate effect targets/operations and conflicts against the chosen template before accepting a selection; an incompatible choice must preserve the previous valid instance.

The feature-library follow-on will define feature-definition documents, catalog discovery and storage, and selected-entry origin fields. Specify stable system, feature and version provenance and compatibility and update behavior before implementing selection. The current closed entry schema supports self-contained entries and effects. The Ork fixture includes a manually authored trait entry.

### Bounded explicit effects

Every effect is exactly `{ "op": "multiply", "target": "toughnessBonus", "factor": 2 }` with the target and factor chosen for that entry. `target` must be in `template.modifierTargets` and reference a derived field. `factor` must be a finite positive safe integer (1 through 2^53-1), with no coercion. Multiplication is the only supported effect operation. Effects cannot contain arbitrary expressions, override or mutate inputs, look up trait names automatically or interpret prose.

Gather effects from all selected entries and validate before calculation. At most one effect per target across the whole instance is supported, even when two factors are identical or occur in the same entry. Reject duplicates as MODIFIER_CONFLICT; do not silently pick one or multiply them together. This is a bounded application policy, not a rulebook stacking assertion. Different targets may be modified simultaneously. Zero matching effects means the base result is used unchanged.

For a derived field, evaluate its template base expression, then apply its one matching multiplication exactly once, and expose the final value to every downstream field reference. Apply the usual finite/safe-number checks to the base, factor and result. Because effects use constant factors only, they add no dependency edges. Recompute from editable values on changes to calculation inputs, using the candidate effects. Normal opening reads the final values already recorded in the sheet. Invalid effects preserve the last valid instance and source file just as invalid core inputs do.

The Ork example carries a trait entry for Unnatural Toughness (x2), citing Phase 1 S6/S7. Its base TB floor(45/10) = 4 becomes 8; at T49 it remains 8, at T50 it becomes 10. The shared template contains only the unmodified floor formula. An explicit Unnatural Strength entry can likewise multiply strengthBonus, regardless of the instance role, career or species. Verification uses a constructed character with both features to establish generic behavior; this does not supply or assert a complete Space Marine profile or legal creation rules. Existing Phase 1 numeric examples remain authoritative; its separate-template/fixed-Ork-multiplier representation and exclusion of editable trait selection are superseded by this user-authorized contract revision. Other trait mechanics remain outside scope.

## Restricted expressions

Each node is one of the closed schema alternatives. No scripts, function names, imports, property traversal, external references or executable strings exist.

| op       | Arguments             | Input / output                   | Semantics                              |
| -------- | --------------------- | -------------------------------- | -------------------------------------- |
| constant | value                 | finite number / number           | Literal value                          |
| field    | id                    | declared field / number          | Exact input or derived field reference |
| divide   | left, right           | number, number / number          | Division; zero divisor is an error     |
| multiply | left, right           | number, number / number          | Multiplication                         |
| floor    | value                 | number / number                  | Round toward negative infinity         |
| equal    | left, right           | number, number / boolean         | Exact numeric equality; no coercion    |
| if       | condition, then, else | boolean, number, number / number | Evaluate only the selected branch      |

Both branches are structurally/type checked and both contribute dependencies, even when unselected. All references must exist in the same template. All nodes are checked before evaluation; reject cycles, including self-references and cycles in unselected branches. Topologically evaluate derived fields after inputs. Boolean outputs are permitted only as if conditions; no boolean input fields. There is no implicit default for a missing field.

Numeric semantics are finite IEEE-754 binary64, rejecting literals/results outside the finite range and integers outside +/-(2^53-1); reject integer field constraints/defaults/values outside that safe range as well. Reject nonfinite intermediate results and division by either signed zero. Normalize negative zero to zero. No implicit rounding except floor. This slice uses exact small integers and 0.5; it requires no decimal tolerance or formatting-rounding policy. Check all editable inputs before evaluation. An if node is lazy only for evaluation, never for dependency/type checking.

The shared base creature template encodes floor(score/10) and explicit zero-AB movement branches; the Ork instance supplies its explicit TB multiplier after floor. No generic engine code identifies Orks or RPG-specific field names. C1/M1 instance values and C2/M2/B1 expectations are inherited from Phase 1. The example instances are incomplete demonstration sheets.

## Diagnostics and preservation

A diagnostic is an object with required `code`, `document` (logical identifier, not arbitrary filesystem authority), `pointer` (RFC 6901 JSON Pointer, empty for document root), and plain-language `message`; optional `related` is an array of `{document, pointer}` objects. Escape `~` and `/` in pointer segments. Return a nonempty diagnostics array on failure; do not return a partially valid replacement as success. Messages should identify expected/actual values where useful without exposing unrelated file contents. Consumers branch on code, never message text.

| code                           | Use                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| INVALID_JSON                   | Malformed JSON, duplicate keys, non-JSON numeric tokens                                         |
| UNSUPPORTED_SCHEMA_VERSION     | Unknown file schema version                                                                     |
| INVALID_STRUCTURE              | Schema violation, unknown property or malformed node                                            |
| INVALID_VALUE                  | Blank name, out-of-range/unsafe input, invalid default/bounds/timestamp order                   |
| DEFINITION_NOT_FOUND           | Exact manifest/template absent                                                                  |
| UNSUPPORTED_DEFINITION_VERSION | ID is known but required version unsupported                                                    |
| IDENTITY_MISMATCH              | Path/document identity, system reference, entityType, role/path or manifest membership mismatch |
| DEFINITION_CONFLICT            | Different content for an immutable identity/version                                             |
| DUPLICATE_ID                   | Repeated field/section/entry ID or manifest pair                                                |
| INVALID_SECTION                | Missing, duplicate or unknown section membership                                                |
| INVALID_MODIFIER               | Undeclared/input target or invalid effect operation/factor                                      |
| MODIFIER_CONFLICT              | More than one effect targets the same derived field                                             |
| MISSING_FIELD                  | Required editable input absent                                                                  |
| UNKNOWN_FIELD                  | Undeclared instance input                                                                       |
| MISSING_REFERENCE              | Expression field reference absent                                                               |
| TYPE_MISMATCH                  | Invalid operand or final result type                                                            |
| DEPENDENCY_CYCLE               | Circular reference; related pointers identify participants                                      |
| DIVISION_BY_ZERO               | Evaluated divisor is zero                                                                       |
| NONFINITE_RESULT               | Literal/intermediate result not finite or unsafe integer                                        |

Schema validation may report INVALID_STRUCTURE for a violation that also has a semantic code; consumers must not require an error ordering or exhaustive cascade. Prefer field-specific pointers. Example: `{ "code": "INVALID_VALUE", "document": "example-explorator-001", "pointer": "/values/agility", "message": "Agility must be an integer from 0 through 99; received 100." }`.

Loading or editing failures retain the last valid instance/results and leave source files untouched. Unsupported definitions are not auto-migrated. No invalid replacement is recalculated or saved. Runtime enforcement and persistence backup/recovery tests belong to their roadmap phases; this phase specifies those obligations without claiming they execute now.

## Verification implementation boundary

The maintained Python package under verification/ verifies file contracts and authored fixture integrity without evaluating arithmetic. Phase 10 retired its bounded arithmetic tracer after production TypeScript tests covered the same independently specified acceptance inputs/results. TypeScript tests reuse the language-neutral authored JSON inputs; expected numbers are explicit test facts. Python retains independent schema, cross-document, expression type/dependency and snapshot compatibility checks. Type hints complement, and never replace, runtime JSON/schema validation.
