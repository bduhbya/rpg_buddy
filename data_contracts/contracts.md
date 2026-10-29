# Version 1 data contract

Normative companion to `data_contracts/v1/*.schema.json` (repository-relative). All JSON is UTF-8. Reject duplicate object keys, non-JSON tokens such as NaN/Infinity, unknown properties and unsupported schemaVersion before using a document. JSON Schema describes structure; semantic checks below are also mandatory. Object key order is insignificant; array order is meaningful. No string-to-number or boolean coercion.

## Identity, versions and library paths

IDs are stable lowercase ASCII slugs (1-64 characters); field IDs are case-sensitive ASCII identifiers as defined by the schema. Identity never comes from a label or filename. The same entity ID remains stable across saves. New instances receive fresh IDs, with collision detection; fixture IDs are not an ID-generation policy. All references use exact id/version pairs. Schema version 1 is independent of definition version `major.minor.patch`; version components have no leading zeros. No ranges, implicit upgrades or newest-version fallback. A changed published definition requires a new version. This is the first unpublished schema-version-1 draft: its earlier separate-template form is replaced here before any application or saved library exists. No migration or compatibility with that superseded draft is implied. Unsupported versions fail without rewriting files.

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

The example folder is an inspectable fixture bundle, not a runtime library. To map it into a library, copy system.json to the active and archived manifest paths, each `examples/templates/<template-id>/<template-version>/template.json` to its exact template path, and each instance to its role-specific path (character -> characters, monster -> monsters). Changing roles must not change arithmetic; filesystem relocation/collision handling will be specified before persistence implementation. A rules directory is reserved by the constitution but unused. There is no shared-rule reference node in v1; adding shared definitions requires an explicit later contract version and resolver. Current formulas stay in their templates.

## Manifest, template and instance semantics

A manifest declares source identity and available template pairs. Source fingerprint identifies the reviewed local PDF, not a runtime file to load. source/sourceRefs contain direct rulebook citations: publication identity, printed page numbers and relevant heading/table. Readers must not need a development phase register to understand the citation. For example, the Ork entry cites Rogue Trader Core Rulebook (2009, RT01, Print ID 01), printed pp. 368 and 377.

Development provenance is optional metadata, separate from rulebook source fields. Templates, input/derived definitions, instances and selected entries may have a metadata object with optional sourceReview (nonblank string), requirementRefs (array of nonblank strings), and sourceRegisterRefs (array of nonblank strings). Unknown metadata properties are rejected; empty objects/arrays are allowed. sourceReview identifies a development review document, requirementRefs records requirement/document identifiers, and sourceRegisterRefs preserves labels such as S6/S7. These values are documentary only; they are never loaded as rules, resolved as dependencies, fetched or executed. Omitting metadata must not prevent loading or change calculations. No top-level sourceReview property is required or supported in the revised template draft.

Template input and derived IDs must be unique across both arrays. Inputs are editable integers with inclusive minimum/maximum; minimum <= maximum and default is within bounds. The generic schema does not impose Rogue Trader ranges; the example template imposes 0-99. Exactly one section membership is required for every field, with no unknown or repeated fields; section IDs are unique. Ordered sections and their fields define UI ordering. Derived expressions must produce numbers. Derived unit is optional; bonuses are dimensionless, movement is metres/round. Default names and labels must be nonblank. The shared base template uses defaultDisplayName `Creature`; it defines the supported structure for any creature using this sheet, independently of specific example instances. It currently covers the agreed core-statistics slice, not every creature mechanic. modifierTargets is a unique array of derived field IDs which accept explicit instance effects; unknown IDs and input field IDs are invalid targets. An empty array disables effects. The shared example allows only strengthBonus and toughnessBonus; its seven derived formulas contain no species, class or role tests.

Instances require exactly the template input keys, no extras, and values satisfying each input constraint. displayName is editable, nonblank, and independent of field expressions. Names need not be unique. Persist optional career text and required entries (empty array permitted) alongside editable values. No calculated results or direct derived-value overrides are saved. All nine base creature attribute defaults are 0, representing an unfilled sheet rather than generated/legal creature statistics; the two example instances supply their own distinct Phase 1 C1/M1 values and names. Timestamps are valid calendar UTC times ending in Z, with createdAt <= modifiedAt. Creation assigns both times; successful source changes update modifiedAt; failed edits/saves must not advance stored state. Runtime clock and save transaction handling belong to later phases.

## Instance role and user-directed selections

entityType describes sheet structure (`creature` in the example), not allegiance, species, career or library category. role is `character` or `monster` for the initial workflows. Both instances reference the same exact creature-core template. A saved monster is an individual library instance, not a template for every monster. Future encounter placement creates an independent instance with provenance; encounter implementation is deferred.

career is optional nonblank free-form career/class text. entries is an ordered array of user-chosen selections. Each entry has a unique stable slug id, category slug (for example skill, talent, feat, trait or custom), nonblank label, description string (may be empty), optional nonblank rulebook source, optional development metadata, and required effects array. Categories and labels are not rules identifiers; duplicate labels are allowed. No canonical career list, prerequisites, complete rulebook catalog, character legality gate or online GM approval is required. Users and GMs may choose homebrew entries. Descriptions and sources never execute or fetch external content. Removing an entry removes its effects on recomputation.

### Feature library and instance snapshots

The template declares calculation structure and generic extension points, not a catalog of selectable skills, talents or traits. modifierTargets lists derived field IDs which may receive supported effects; it neither creates an effect nor declares that every possible operation is supported. The current operation remains multiply, and the current template permits strengthBonus and toughnessBonus only. No template list of Unnatural Strength, Unnatural Toughness or other feature IDs is needed.

Reusable feature choices belong to a separate, system-specific feature library. When selection is implemented, adding a feature must create an independent instance entry snapshot containing its label, category, description, rulebook source when present, and explicit supported effects. Each selected entry gets its own instance-local ID. Feature definition identity and exact version are provenance for that selection, separate from both that local entry ID and optional development metadata. No engine behavior may depend on a feature's label or library identity.

The saved snapshot is authoritative for that instance. Library edits/deletion or a missing library must not silently change or invalidate existing selected entries. Updating a selection from a newer library version must be an explicit user action with validation before replacement; automatic updates and live references are excluded. Custom entries use the same shape and must remain possible without any library origin. Validate effect targets/operations and conflicts against the chosen template before accepting a selection; an incompatible choice must preserve the previous valid instance.

This is an architectural commitment for the feature-library follow-on, not a claim that a library exists in v1. The current schemas already support self-contained instance entries and effects, but do not yet define feature-definition documents, catalog discovery/storage, or a selected entry's library-origin property. Before implementing selection, specify those exact shapes, stable system/feature/version provenance and compatibility/update behavior in a bounded phase. Do not add undeclared origin fields to the current closed entry schema. The existing Ork fixture represents the resulting self-contained trait entry; it is not yet produced by an implemented library selection process.

### Bounded explicit effects

Every effect is exactly `{ "op": "multiply", "target": "toughnessBonus", "factor": 2 }` with the target/factor chosen for that entry. target must be in template.modifierTargets and reference a derived field. factor must be a finite positive safe integer (1 through 2^53-1), with no coercion. This is the sole v1 effect operation. No arbitrary effect expression, direct value override, input mutation, automatic trait-name lookup or prose interpretation is supported.

Gather effects from all selected entries and validate before calculation. At most one effect per target across the whole instance is supported, even when two factors are identical or occur in the same entry. Reject duplicates as MODIFIER_CONFLICT; do not silently pick one or multiply them together. This is a bounded application policy, not a rulebook stacking assertion. Different targets may be modified simultaneously. Zero matching effects means the base result is used unchanged.

For a derived field, evaluate its template base expression, then apply its one matching multiplication exactly once, and expose the final value to every downstream field reference. Apply the usual finite/safe-number checks to the base, factor and result. Because effects use constant factors only, they add no dependency edges; validate the template graph normally. Re-evaluate from editable values on every valid edit/load; never multiply a cached final value again. Invalid effects preserve the last valid instance/results and source file just as invalid core inputs do.

The Ork example carries a trait entry for Unnatural Toughness (x2), citing Phase 1 S6/S7. Its base TB floor(45/10) = 4 becomes 8; at T49 it remains 8, at T50 it becomes 10. The shared template contains only the unmodified floor formula. An explicit Unnatural Strength entry can likewise multiply strengthBonus, regardless of the instance role, career or species. Verification uses a constructed character with both features to establish generic behavior; this does not supply or assert a complete Space Marine profile or legal creation rules. Existing Phase 1 numeric examples remain authoritative; its separate-template/fixed-Ork-multiplier representation and exclusion of editable trait selection are superseded by this user-authorized contract revision. Other trait mechanics remain outside scope.

## Restricted expressions

Each node is one of the closed schema alternatives. No scripts, function names, imports, property traversal, external references or executable strings exist.

| op | Arguments | Input / output | Semantics |
| --- | --- | --- | --- |
| constant | value | finite number / number | Literal value |
| field | id | declared field / number | Exact input or derived field reference |
| divide | left, right | number, number / number | Division; zero divisor is an error |
| multiply | left, right | number, number / number | Multiplication |
| floor | value | number / number | Round toward negative infinity |
| equal | left, right | number, number / boolean | Exact numeric equality; no coercion |
| if | condition, then, else | boolean, number, number / number | Evaluate only the selected branch |

Both branches are structurally/type checked and both contribute dependencies, even when unselected. All references must exist in the same template. All nodes are checked before evaluation; reject cycles, including self-references and cycles in unselected branches. Topologically evaluate derived fields after inputs. Boolean outputs are permitted only as if conditions; no boolean input fields. There is no implicit default for a missing field.

Numeric semantics are finite IEEE-754 binary64, rejecting literals/results outside the finite range and integers outside +/-(2^53-1); reject integer field constraints/defaults/values outside that safe range as well. Reject nonfinite intermediate results and division by either signed zero. Normalize negative zero to zero. No implicit rounding except floor. This slice uses exact small integers and 0.5; it requires no decimal tolerance or formatting-rounding policy. Check all editable inputs before evaluation. An if node is lazy only for evaluation, never for dependency/type checking.

The shared base creature template encodes floor(score/10) and explicit zero-AB movement branches; the Ork instance supplies its explicit TB multiplier after floor. No generic engine code identifies Orks or RPG-specific field names. C1/M1 instance values and C2/M2/B1 expectations are inherited from Phase 1. The example instances are incomplete demonstration sheets.

## Diagnostics and preservation

A diagnostic is an object with required `code`, `document` (logical identifier, not arbitrary filesystem authority), `pointer` (RFC 6901 JSON Pointer, empty for document root), and plain-language `message`; optional `related` is an array of `{document, pointer}` objects. Escape `~` and `/` in pointer segments. Return a nonempty diagnostics array on failure; do not return a partially valid replacement as success. Messages should identify expected/actual values where useful without exposing unrelated file contents. Consumers branch on code, never message text.

| code | Use |
| --- | --- |
| INVALID_JSON | Malformed JSON, duplicate keys, non-JSON numeric tokens |
| UNSUPPORTED_SCHEMA_VERSION | Unknown file schema version |
| INVALID_STRUCTURE | Schema violation, unknown property or malformed node |
| INVALID_VALUE | Blank name, out-of-range/unsafe input, invalid default/bounds/timestamp order |
| DEFINITION_NOT_FOUND | Exact manifest/template absent |
| UNSUPPORTED_DEFINITION_VERSION | ID is known but required version unsupported |
| IDENTITY_MISMATCH | Path/document identity, system reference, entityType, role/path or manifest membership mismatch |
| DEFINITION_CONFLICT | Different content for an immutable identity/version |
| DUPLICATE_ID | Repeated field/section/entry ID or manifest pair |
| INVALID_SECTION | Missing, duplicate or unknown section membership |
| INVALID_MODIFIER | Undeclared/input target or invalid effect operation/factor |
| MODIFIER_CONFLICT | More than one effect targets the same derived field |
| MISSING_FIELD | Required editable input absent |
| UNKNOWN_FIELD | Undeclared instance input |
| MISSING_REFERENCE | Expression field reference absent |
| TYPE_MISMATCH | Invalid operand or final result type |
| DEPENDENCY_CYCLE | Circular reference; related pointers identify participants |
| DIVISION_BY_ZERO | Evaluated divisor is zero |
| NONFINITE_RESULT | Literal/intermediate result not finite or unsafe integer |

Schema validation may report INVALID_STRUCTURE for a violation that also has a semantic code; consumers must not require an error ordering or exhaustive cascade. Prefer field-specific pointers. Example: `{ "code": "INVALID_VALUE", "document": "example-explorator-001", "pointer": "/values/agility", "message": "Agility must be an integer from 0 through 99; received 100." }`.

Loading or editing failures retain the last valid instance/results and leave source files untouched. Unsupported definitions are not auto-migrated. No invalid replacement is recalculated or saved. Runtime enforcement and persistence backup/recovery tests belong to their roadmap phases; this phase specifies those obligations without claiming they execute now.

## Verification implementation boundary

The maintained Python package under verification/ verifies these file contracts and explicitly expected fixture results. Its small expression tracer checks the existing bounded contract subset before the application exists; it must not grow into a parallel production engine. The TypeScript engine remains the production implementation. When available, it must be tested against the same independently specified acceptance inputs/results; migrate shared cases into language-neutral fixtures and retire overlapping Python tracing where appropriate. Contract integrity checks can remain independent. Type hints complement, and never replace, runtime JSON/schema validation.
