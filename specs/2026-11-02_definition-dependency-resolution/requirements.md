# Phase 8: Definition dependency resolution - Requirements

## 1. Context

Phase 7 supplies pure structural validators. Phase 8 resolves existing v1 definitions in memory. Authorities: ../mission.md, ../tech-stack.md, ../roadmap.md, ../../data_contracts/contracts.md and the v1 schemas. The user accepted scope, two review checkpoints and proposed validation on 2026-11-02.

## 2. Scope

- DR-1: Construct a synchronous in-memory source from logically named parsed manifest/template documents, using existing validators.
- DR-2: Look up exact pairs and reject missing IDs, unavailable versions and conflicting immutable definitions.
- DR-3: Resolve a requested system/template pair, checking exact manifest membership and template.system agreement.
- DR-4: Preserve caller data, return actionable diagnostics without partial success, and keep the domain independent of infrastructure.

Exclude shared rules and contract revisions, expression reference/type/cycle analysis, calculation, instance validation, filesystem, JSON parsing, application wiring and UI. V1 has no shared-rule node. Feature catalog follow-on remains deferred as committed in the roadmap; it is not added here.

## 3. Product decisions

No version ranges, newest fallback, migration or coercion. An ID absent from its namespace yields DEFINITION_NOT_FOUND; a known ID with an absent exact version yields UNSUPPORTED_DEFINITION_VERSION. Identical duplicate documents are permitted; different contents for an immutable pair yield DEFINITION_CONFLICT. Object property order is immaterial; array order and documentary metadata are significant. Templates are namespaced by system ID, then template ID/version. Their system version is content, not another identity dimension. Manifests are keyed by system ID/version.

The source snapshots parsed JSON-compatible inputs; lookups return independent copies so later caller edits cannot corrupt its validated index. Logical document labels are diagnostic context, never paths to dereference. Source construction is atomic and validates all supplied documents, including unrequested ones. Missing referenced documents are checked on resolution rather than construction. No ordering/exhaustive cascade guarantee applies to diagnostics.

## 4. Technical requirements

Use ValidationResult and existing diagnostic codes and RFC 6901 locations. Source entries have document and unknown value properties, supplied separately as manifest/template arrays. Typed lookup requests are runtime-checked for exact reference formats. Failure exposes no source or partial definition. Conflict diagnostics identify both logical documents. Lookup diagnostics point to the caller's supplied reference location. Successful lookups retain the source document label alongside the copied value.

Resolution returns the requested validated manifest/template pair only after both cross-document checks pass. It does not require every other manifest-listed template to be present. No logging or infrastructure dependency is needed for pure operations. Parsed JSON boundaries exclude cyclic objects, getters and proxies.

Review decision: on 2026-11-02 the user requested the name InMemoryDefinitionCatalog and authorized step 2. The constructor is createInMemoryDefinitionCatalog; source and mirrored test filenames use in-memory-definition-catalog. resolveDefinitions accepts an unknown closed request containing system and template references plus a separate logical request document label. Missing dependencies point into that request. Membership mismatches point to its /template and relate the manifest's /templates and template root; system-reference mismatches point to the template's /system and relate the request and manifest. The catalog's namespace lookup enforces system ID isolation; resolver equality also checks the system version.

## 5. Accessibility requirements

No interface changes, so keyboard, focus and screen-reader UI checks are not applicable. Preserve semantic labels/order and supply plain-language diagnostics with useful locations for future accessible feedback.

## 6. Completion requirements

DR-1/DR-2: authored fixtures and distinct versions resolve exactly; malformed documents/requests, missing IDs/versions and conflicts fail without mutation. DR-3: accepted pairs resolve and incompatible system references or membership fail. DR-4: unit tests, strict TypeScript, domain boundary checks, Python verifier, formatting and diff checks pass. Human walkthrough is supplementary; record actual execution separately.
