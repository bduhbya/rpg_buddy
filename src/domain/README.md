# Domain API reference

The domain provides framework-independent definition validation, exact-version resolution, instance operations, and calculation. The [architecture guide](architecture.md) describes how these operations fit together, including [instance creation](architecture.md#create-an-instance) and [editing](architecture.md#edit-an-instance).

Run test commands from the repository root.

## Definition validation API

`validateSystemManifest(value, document)` in `src/domain/definition-processing/validate-manifest.ts` and `validateTemplate(value, document)` in `src/domain/definition-processing/validate-template.ts` accept unknown parsed JSON and a caller-supplied logical document identifier. Both return either `{ success: true, value }` or `{ success: false, diagnostics }`. Check `success` before accessing the corresponding property. Diagnostic codes are stable; messages describe the issue and pointers locate it within the document.

These pure validators check closed v1 shapes and document-local constraints without changing the input. Successful values reference the original object: revalidate after mutation. Template validation checks expression syntax in every branch, but does not resolve referenced fields/definitions, infer expression types, detect dependency cycles or calculate results. Structural success alone does not make a definition ready for evaluation. Definition file loading and saved-instance validation belong to later phases.

## In-memory definition catalog API

`createInMemoryDefinitionCatalog(manifests, templates)` in `src/domain/definition-processing/in-memory-definition-catalog.ts` accepts two arrays of `{ document, value }` entries, where `value` is unknown parsed JSON and `document` is a logical diagnostic label. It validates the complete bundle atomically and returns the same discriminated result shape. Success provides `getSystem(reference, location)` and `getTemplate(systemId, reference, location)`. Pass a closed `{ id, version }` reference and a `{ document, pointer }` location describing the requesting dependency. Successful lookups return `{ document, value }` inside the result's `value` property.

Lookups are exact: no fallback or migration occurs. Missing IDs produce `DEFINITION_NOT_FOUND`; known IDs with unavailable versions produce `UNSUPPORTED_DEFINITION_VERSION`. Template IDs are scoped to their system ID. Identical duplicate definitions are accepted regardless of object key order; different content claiming the same immutable pair fails construction with `DEFINITION_CONFLICT` and both document locations. Array order and metadata are content. Construction snapshots inputs and every lookup returns a fresh copy, protecting the index from subsequent caller edits. The catalog checks structure and conflicts only. It performs no filesystem access or calculation.

`resolveDefinitions(catalog, request, document)` in `src/domain/definition-processing/resolve-definitions.ts` accepts an unknown parsed request shaped as `{ system: { id, version }, template: { id, version } }` and a logical request document label. It validates that closed request, retrieves the exact definitions, checks that the manifest lists the exact template pair, and checks that the template references the exact requested system. Success returns `{ system, template }`, each a located independent copy. Failures expose diagnostics without partial results. Membership mismatches point to the request's `/template`; system-reference mismatches point to the template's `/system`, with related document locations. Missing dependencies retain lookup codes at `/system` or `/template` in the request. Unrelated manifest entries and documentary metadata are not resolved. V1 has no shared-rule references. Calculation is a separate operation that uses the resolved template.

## Base calculations

`calculateBase(template, sourceValues)` in `src/domain/calculation/calculate-base.ts` accepts the located template returned by `resolveDefinitions` and a separate `{ document, value }` containing the complete input-value map. The diagnostic document labels are logical identities. Input pointers are relative to that value map. The function revalidates the template, plans dependencies, checks operand types throughout both conditional branches, validates all inputs, and evaluates derived fields in dependency order. Success returns `{ success: true, value: Record<string, number> }` containing only derived values. Failure returns diagnostics without partial values. Caller objects are preserved and every call recomputes with a new cache.

Supported expressions follow the [v1 contract](../../data_contracts/contracts.md). Conditional evaluation is lazy, division rejects either signed zero, numeric intermediates must be finite with integers in the safe range, and negative zero becomes zero. Inputs must be explicitly provided, even when template defaults exist. This API computes base values only. For example, the authored Ork has base Toughness Bonus 4; calculateWithEntries applies its instance-owned effect to produce 8.

The shared-engine acceptance command is `npm run test:unit -- tests/unit/domain/calculation-engine.test.ts`. Its independent expectations cover both resolved examples, edited scores, boundary values, ordering, recovery after invalid input, branch behavior, malformed nodes and arithmetic failures. The base API has a focused smoke test in calculate-base.test.ts.

## Instance-entry effects

`calculateWithEntries(template, sourceValues, entries)` in `src/domain/calculation/calculate-with-entries.ts` accepts a located resolved template, located complete value map, and located unknown entry array. It validates the closed v1 snapshot contract, then recomputes derived values without changing caller data. Entry pointers are relative to the supplied array's logical document root, such as `/0/effects/0/target`.

Only explicit positive safe-integer multiplication on template-declared derived targets is supported. A second effect on one target is rejected with `MODIFIER_CONFLICT`, including identical effects or duplicates in one entry. Each field's base formula runs before its effect, and downstream expressions see the modified final value. Labels, descriptions, category, role and development metadata do not select mechanics. No partial results are returned on failure; the caller retains its last valid instance and results. This API returns derived results in memory and does not validate or save a complete instance.

Effect operation validation and execution share the exhaustive registry in `src/domain/calculation/effect-operations.ts`. Extending `EntryEffect` requires handlers for the new operation at compile time, plus an explicit versioned contract/schema change and acceptance tests.

Run `npm run test:unit -- tests/unit/domain/effect-operations.test.ts tests/unit/domain/validate-entry-effects.test.ts tests/unit/domain/calculate-with-entries.test.ts` for operation, entry and effect integration coverage. The Python contract verifier retains independent document integrity checks; its overlapping arithmetic evaluator has been retired. See the [domain architecture](architecture.md) for the file-labeled flow and the [Phase 10 walkthrough](../../specs/2026-11-04_instance-entry-effects/validation.md) for reproducible review steps.

## Instance editing

Call [editInstance](instances/edit-instance.ts) with a validated catalog, a previously valid instance, a clock with `now()`, a diagnostic label, and one operation. For example, `editInstance(catalog, ork, clock, 'ork', 'set-value', 'toughness', 50)` changes Toughness to 50.

| Operation          | Arguments after the operation name                           |
| ------------------ | ------------------------------------------------------------ |
| `set-value`        | Template input field ID and a number                         |
| `set-display-name` | Nonblank display name                                        |
| `set-career`       | Nonblank career text or `null` to clear it                   |
| `add-entry`        | JSON text for a complete entry snapshot with a new local ID  |
| `replace-entry`    | JSON text for a complete snapshot with the existing local ID |
| `remove-entry`     | Existing local entry ID                                      |

The domain parses entry JSON and rejects malformed text and duplicate object keys before using the snapshot. Each call validates and recalculates one private candidate. Success returns `{ instance, derived }` inside `value`. Failure returns diagnostics, leaving the previous instance and results available to the caller. Equivalent edits recalculate and keep the current modification timestamp. To make multiple changes, pass each successful result's instance to the next call.

## Domain tests

Domain tests live under [tests/unit/domain](../../tests/unit/domain/). For example, [validate-manifest.test.ts](../../tests/unit/domain/validate-manifest.test.ts) exercises the [manifest validator](definition-processing/validate-manifest.ts). The same directory holds the domain-wide type and dependency checks and the shared fixture loader.
