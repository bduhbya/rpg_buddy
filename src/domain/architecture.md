# Domain architecture

This is a living guide to the domain code. Update it when responsibilities, public APIs, data ownership or calculation flow change. The [constitution](../../specs/mission.md) and [data contracts](../../data_contracts/contracts.md) define the governing requirements. This guide describes their implementation. For call signatures and diagnostic details, see the [domain API reference](README.md).

## Use cases

- [Resolve a system and template](#resolve-a-system-and-template) before creating or calculating an instance.
- [Create an instance](#create-an-instance) with independent source values, results and presentation.
- [Open a saved instance](#open-a-saved-instance) from its recorded values and exact references.
- [Edit an instance](#edit-an-instance) and update its recorded results when calculation inputs change.
- [Calculate base values](#calculate-base-values) from a resolved template and editable inputs.
- [Calculate with entry effects](#calculate-with-entry-effects) to include selected instance features.

Diagram boxes show the relevant function or type and its source filename. Public operations return a discriminated result. Check `success` before reading `value` or `diagnostics`. Failures return diagnostics without partial values. A diagnostic identifies a logical document and a JSON Pointer, with related locations where useful.

## Resolve a system and template

Use this when a caller has parsed manifests and templates and needs the exact pair referenced by an instance or creation request.

```mermaid
flowchart TD
    A["Parsed manifests and templates<br/>ParsedDefinition · in-memory-definition-catalog.ts"] --> B["Validate and build catalog<br/>createInMemoryDefinitionCatalog · in-memory-definition-catalog.ts"]
    B --> D["Look up exact versions<br/>InMemoryDefinitionCatalog · in-memory-definition-catalog.ts"]
    C["Requested system and template IDs and versions<br/>DefinitionRequest · resolve-definitions.ts"] --> D
    D --> E["Check manifest membership and system reference<br/>resolveDefinitions · resolve-definitions.ts"]
    E --> F["Located system and template<br/>ResolvedDefinitions · resolve-definitions.ts"]
```

[Catalog construction](definition-processing/in-memory-definition-catalog.ts) validates every supplied [manifest](definition-processing/validate-manifest.ts) and [template](definition-processing/validate-template.ts) before exposing an index. Conflicting copies of the same version fail construction. The catalog owns snapshots and returns independent copies on lookup.

[Resolution](definition-processing/resolve-definitions.ts) checks that the exact system and template versions are available, that the manifest lists the template, and that the template points back to that system version. Missing versions fail at the requested reference. A caller can pass the resolved template directly to either calculation operation.

## Create an instance

Use this when a caller wants a new character or monster initialized from template defaults.

```mermaid
flowchart TD
    A["System and template references, plus role<br/>CreateInstanceRequest · create-instance.ts"] --> B["Validate request and resolve exact pair<br/>createInstance · create-instance.ts<br/>resolveDefinitions · resolve-definitions.ts"]
    B --> F["Calculate initial results from defaults<br/>calculateBase · calculate-base.ts"]
    F --> C["Obtain and validate ID, then UTC time<br/>createInstance · create-instance.ts"]
    P["Caller supplies ID and time providers<br/>InstanceCreationProviders · create-instance.ts"] --> C
    C --> D["Snapshot ordered sections, labels and units<br/>createInstance · create-instance.ts"]
    D --> E["Complete v2 sheet<br/>Instance · document-models.ts"]
```

[Instance creation](instances/create-instance.ts) calculates from the exact template's editable defaults and empty entries. After calculation succeeds, the providers supply a fresh ID and one timestamp for both creation and modification. Each instance owns its reference objects, input map, entries, final results and presentation snapshot.

## Open a saved instance

A saved sheet already contains its final statistics and the presentation needed to display them. The main process owns the file read and determines whether the sheet can be edited. The domain validates the recorded data in two passes.

```mermaid
flowchart TD
    A["Canonical library path and strict JSON read<br/>loadSavedInstance · instance-loader.ts"] --> B["Validate the recorded snapshot<br/>validateInstanceSnapshot · validate-instance-snapshot.ts"]
    A -->|Read or parse failure| X["Reject with diagnostics"]
    B -->|Invalid snapshot| X
    B -->|Valid snapshot| C["Check system, role and instance ID against the path"]
    C -->|Mismatch| X
    C -->|Matches| D{"Exact archived definitions available?<br/>loadExactDefinitions · definition-loader.ts"}
    D -->|Unavailable| R["Return the recorded sheet read-only with dependency diagnostics"]
    D -->|Resolved| E["Check compatibility<br/>checkInstanceTemplate · check-instance-template.ts"]
    E -->|Conflict| X
    E -->|Compatible| F["Return the recorded sheet and exact definitions for editing"]
```

1. [Snapshot validation](instances/validate-instance-snapshot.ts) checks schema, identity and references, UTC timestamps, field maps, presentation coverage, entries and effects using the saved data alone. [Section validation](instances/check-sections.ts) is shared with template validation. It preserves the diagnostics appropriate to each document.
2. [Template compatibility](instances/check-instance-template.ts) checks the entity type, field sets, input bounds, ordered presentation and permitted effect targets against the resolved exact template. The resolver establishes manifest membership and version identity before this pass.

The [main-process loader](../main/instance-loader.ts) uses the archived revisions named in the sheet. Both successful modes return the same recorded data. Opening performs no formula evaluation, effect application or writes. The loader and snapshot validator share an operation ID through an injected logger. The snapshot validator records the validation outcome without exposing sheet contents or paths.

## Edit an instance

Pass a previously valid in-memory instance and one operation to [editInstance](instances/edit-instance.ts). Scalar operations use primitive arguments. Adding or replacing an entry uses JSON text for the complete snapshot, and removal uses its local ID. See the [operation signatures](README.md#instance-editing).

```mermaid
flowchart TD
    A["Previously valid sheet and one operation<br/>editInstance · edit-instance.ts"] --> B["Apply edit to a private copy and resolve exact definitions"]
    B --> C["Validate changed entries and compare effects by target"]
    C --> D{"Source values or effects changed?"}
    D -->|Yes| E["Recompute final values<br/>calculateWithEntries · calculate-with-entries.ts"]
    D -->|No| F["Carry forward recorded values"]
    E --> G{"Sheet changed?"}
    F --> G
    G -->|Yes| H["Read and validate modification time"]
    G -->|No| I["Return the complete sheet"]
    H --> I
    B -->|Failure| J["Return diagnostics and preserve the prior sheet"]
    C -->|Failure| J
    E -->|Failure| J
    H -->|Failure| J
```

[calculateWithEntries](calculation/calculate-with-entries.ts) recomputes from the candidate's source values and effects. Comparing effects by target lets a descriptive entry edit keep the recorded results even when the entry snapshot changes.

Setting the authored Ork's Toughness from 45 to 50 raises its effect-adjusted Toughness Bonus from 8 to 10. Removing Unnatural Toughness in a separate call recalculates the bonus to 5. Each call succeeds or fails independently, so the caller can continue from the last successful instance and results.

A changed instance receives a modification timestamp from the caller's UTC clock after validation and any required calculation succeed. An equivalent edit keeps the timestamp and skips the clock. Calculation diagnostics for source values and entries use separate logical documents, such as `ork values` and `ork entries`.

## Calculate base values

Use [calculateBase](calculation/calculate-base.ts) when you need derived values from a template's formulas alone. Supply a located template and a separate located input map.

```mermaid
flowchart TD
    A["Located template and complete input map<br/>calculateBase · calculate-base.ts"] --> B["Revalidate template and plan dependencies<br/>validateTemplate · validate-template.ts<br/>planCalculations · plan-calculations.ts"]
    B --> C["Check expression types and input values<br/>calculateDerived · calculation-engine.ts"]
    C --> D["Evaluate fields in dependency order<br/>evaluateExpression · calculation-engine.ts"]
    D --> E["Derived values by field ID<br/>ValidationResult · structural-validation.ts"]
```

The [shared engine](calculation/calculation-engine.ts) revalidates mutable template copies. The [dependency planner](calculation/plan-calculations.ts) checks missing references and cycles before the engine evaluates formulas. The base operation uses an empty entry array.

Inputs must contain exactly the declared own keys, with safe integer values inside their inclusive bounds. Template defaults describe initialization. Callers must supply a complete input map to calculate.

Supported operations are `constant`, `field`, `floor`, `divide`, `multiply`, `equal` and `if`. They form a data-defined expression tree. Every reference must name an input or derived field in the same template.

Both conditional branches contribute dependencies and undergo syntax and type checks. Evaluation executes only the selected branch. Derived fields must produce numbers, with boolean expressions permitted as conditional tests.

Numbers follow the contract's finite binary64 and safe-integer rules. Division by either signed zero fails. Every evaluated numeric intermediate is checked, negative zero becomes zero, and `floor` provides the explicit rounding operation.

### Example

This example assumes `catalog` was successfully created from parsed definitions and `instance` contains the caller's instance data.

```ts
const resolved = resolveDefinitions(
  catalog,
  { system: instance.system, template: instance.template },
  'instance',
);

if (resolved.success) {
  const calculated = calculateBase(resolved.value.template, {
    document: 'instance-values',
    value: instance.values,
  });

  if (calculated.success) {
    // With Strength 45, the creature template produces strengthBonus 4.
    const strengthBonus = calculated.value.strengthBonus;
  } else {
    // Present calculated.diagnostics to the caller.
  }
} else {
  // Present resolved.diagnostics to the caller.
}
```

This example uses only the exact references and editable inputs. See [opening a saved instance](#open-a-saved-instance) for the complete snapshot checks.

## Calculate with entry effects

Use [calculateWithEntries](calculation/calculate-with-entries.ts) when the caller also has the instance's selected entry snapshots. The shared engine runs the base preparation flow and adds entry validation and effect application.

```mermaid
flowchart TD
    A["Instance entry snapshots<br/>calculateWithEntries · calculate-with-entries.ts"] --> B["Validate entries and index effects by target<br/>validateEntryEffects · validate-entry-effects.ts"]
    C["Validated template and inputs in dependency order<br/>calculateDerived · calculation-engine.ts"] --> D["Evaluate the field’s base formula<br/>evaluateExpression · calculation-engine.ts"]
    B --> E["Apply the target’s effect if present and check the result<br/>applyEffectOperation · effect-operations.ts<br/>calculateDerived · calculation-engine.ts"]
    D --> E
    E --> F["Store the final field value<br/>calculateDerived · calculation-engine.ts"]
    F -->|Next field reads stored values| D
    F -->|All fields complete| G["Derived values by field ID<br/>ValidationResult · structural-validation.ts"]
```

[Entry validation](calculation/validate-entry-effects.ts) runs after dependency planning and before expression type and input checks. It validates the closed entry shape and effect targets before arithmetic. Entry diagnostic pointers are relative to the supplied array's logical document root, such as `/0/effects/0/target`.

Entry IDs must be unique. Descriptive fields and optional metadata are validated but never interpreted as rules. Multipliers must be positive safe integers targeting a declared derived modifier target. A second effect on a target fails with `MODIFIER_CONFLICT` and a related location for the first effect, even inside the same entry or with identical factors.

For the authored Ork, the base formula floors Toughness 45 divided by 10 to produce Toughness Bonus 4. The entry-aware calculation applies the selected Unnatural Toughness multiplier to produce 8. The engine stores 8 before evaluating any dependent field, so a field reference sees the modified bonus. The base-only call uses an empty entry array and returns 4.

Effects add no dependency edges. Each invocation owns fresh maps and preserves the caller's data and earlier results. The application layer retains the last valid instance on failure.

`EntryEffect` in `document-models.ts` defines the supported effect union. [The effect registry](calculation/effect-operations.ts) is checked with `satisfies EffectOperationHandlers`, keyed by every operation in that union. Each registration owns both closed-shape validation and arithmetic. Adding an operation to the union requires its registration at compile time; supported-operation diagnostics are derived from the registry keys. Unknown operations, including inherited object-property names, are rejected. New operations still require an explicit versioned contract/schema change and acceptance coverage.

## Shared data and utilities

| Piece              | Responsibility                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| System manifest    | Identifies a system version and lists its available exact template versions.                                               |
| Template           | Defines generic sheet structure, inputs, bounds, defaults, derived formulas, sections and eligible modifier targets.       |
| Instance           | Owns identity, role, exact references, timestamps, editable values, entries, final statistics and presentation.            |
| Calculation result | Holds freshly evaluated statistics. Creation and calculation-affecting edits publish them as the instance's `derived` map. |

Calculation definitions live in templates. A v2 instance carries its source state, final statistics, semantic presentation and exact definition references. Resolving those references supplies the rules for edits. The stored values and presentation are sufficient to display a complete sheet.

Published definition versions are immutable. An existing instance uses its recorded version references to determine which definitions enable editing.

Selected entries own snapshots of their descriptions and explicit effects. Those selections can survive changes to a future feature library. Their effects are part of the instance state, while generic formulas and permitted effect targets belong to the template.

[Document types](definitions/document-models.ts) define the manifest, template, instance and entry shapes. The `definitions/` folder holds [references and metadata](definitions/common.ts), [expression types](definitions/expressions.ts), [diagnostics](definitions/diagnostics.ts), and [identifier and version patterns](definitions/definition-patterns.ts). [Shared structural validation](instances/structural-validation.ts) owns result types, structural checks and pointer escaping. The [expression syntax checker](definition-processing/validate-expression.ts) runs during template validation.

## Boundaries and upcoming work

Domain modules depend on other domain modules. Filesystem access, Electron, React and concrete logging infrastructure belong outside this directory. The main process reads definitions and saved sheets, invokes domain validation and supplies the logger. The domain accepts a narrow logger interface by injection. The desktop sheet save/load controls are scheduled for a later phase.

| Capability                                                              | Current status                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Definition structure validation, in-memory catalog and exact resolution | Implemented.                                                                         |
| Dependency analysis and base expression evaluation                      | Implemented.                                                                         |
| Instance-entry effect application                                       | Implemented; Phase 10 acceptance and verifier migration are complete.                |
| In-memory instance creation                                             | Produces complete v2 sheets with calculated initial values and presentation.         |
| In-memory instance editing                                              | Publishes complete v2 sheets. Evaluates only when source values or effects change.   |
| Complete saved-instance validation                                      | Implemented for standalone snapshots and exact-template compatibility.               |
| Library discovery, selected-system loading and saved-instance loading   | Implemented in the main process.                                                     |
| Safe instance saving                                                    | Planned for Phase 18.                                                                |
| Reusable feature library and selection provenance                       | Requires its own future specification. Current entries are instance-owned snapshots. |

The Python contract verifier retains schema and fixture integrity checks, including expression types/dependencies and snapshot compatibility. Phase 10 retired its arithmetic tracer and calculation API after migrating acceptance to the TypeScript tests; only TypeScript evaluates derived values.

## Verification and maintenance

Domain tests live under [tests/unit/domain](../../tests/unit/domain/). The dependency boundary test checks domain imports. Shared engine tests call calculateDerived directly and use independent expected results for the character and monster examples, edited scores, numeric boundaries and failure paths. Entry validation and operation registry tests call their owning modules directly. The public calculation API suites retain focused integration checks for base-only behavior, effect propagation, diagnostics, recovery and caller preservation.

Run `npm run test:unit` and `npm run typecheck` for domain changes. Run `npm run format:check` for documentation formatting. Follow the active phase's validation document for additional required checks.

When changing a public domain operation, update the relevant use case, flow and example here as needed. Keep implementation status explicit and distinguish recorded final values from explicit calculation calls. Detailed decisions and validation evidence remain in the phase specifications.
