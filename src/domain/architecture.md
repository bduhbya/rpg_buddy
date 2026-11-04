# Domain architecture

This is a living guide to the domain code. Update it when responsibilities, public APIs, data ownership or calculation flow change. The [constitution](../../specs/mission.md) and [v1 contract](../../data_contracts/contracts.md) define the governing requirements. This guide describes their implementation.

## What owns what

| Piece              | Responsibility                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| System manifest    | Identifies a system version and lists its available exact template versions.                                                   |
| Template           | Defines generic sheet structure, inputs, bounds, defaults, derived formulas, sections and eligible modifier targets.           |
| Instance           | Holds one entity's identity, role, editable values, selected entry snapshots, timestamps and exact system/template references. |
| Calculation result | Holds recomputed derived values for the supplied inputs. The caller can use these for presentation.                            |

Calculation definitions live in templates. Instances remain small and readable, including for advanced users writing JSON manually. A saved instance carries its current source state and exact definition references. Resolving those references supplies the rules needed to calculate its derived values.

Published definition versions are immutable. A newer template does not implicitly change an existing instance's rules. Loading an instance requires its referenced definitions to be available.

Selected entries own snapshots of their descriptions and explicit effects. Those selections can survive changes to a future feature library. Their effects are part of the instance state, while generic formulas and permitted effect targets belong to the template.

## Current flow

The domain receives parsed objects from its caller. The implemented flow is shown below.

```mermaid
flowchart TD
    M[Parsed system manifests] --> C[createInMemoryDefinitionCatalog]
    T[Parsed templates] --> C
    C --> R[resolveDefinitions]
    I[Exact system and template references] --> R
    R --> RT[Resolved template]
    RT --> B[calculateBase]
    V[Complete instance input values] --> B
    B --> S[Validate template structure]
    S --> G[Plan dependencies]
    G --> Y[Check all expression operand types]
    Y --> X[Validate supplied inputs]
    X --> E[Evaluate in dependency order]
    E --> O[Derived base values]
```

Each public operation returns a discriminated result. Check `success` before reading `value` or `diagnostics`. A failure exposes diagnostics without partial results. Diagnostics identify a logical document and an RFC 6901 JSON Pointer, with related locations where useful.

The catalog validates the whole supplied bundle before exposing a usable index. It snapshots definitions and returns fresh copies from lookups. The resolver checks exact version availability, manifest membership and agreement between the requested system and the template's system reference.

Calculation receives the resolved template and a separate value map. It revalidates the mutable template copy, checks the dependency graph, checks types throughout every expression branch, and validates all inputs before evaluation. The result contains only derived values. Each call uses a fresh cache and preserves the caller's data.

## Example

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

These calls do not validate a complete saved instance. The example uses only its exact references and input values. Full saved-instance validation belongs to the loading phase.

## Modules

| Module                                                             | Role                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [common.ts](common.ts)                                             | Exact definition references and documentary metadata types.                                                                  |
| [documents.ts](documents.ts)                                       | Manifest, template, instance, field and entry shapes. Type declarations describe data but do not perform runtime validation. |
| [expressions.ts](expressions.ts)                                   | The restricted v1 expression union.                                                                                          |
| [diagnostics.ts](diagnostics.ts)                                   | Diagnostic codes and location shapes.                                                                                        |
| [definition-patterns.ts](definition-patterns.ts)                   | Shared identifier and version patterns.                                                                                      |
| [validation.ts](validation.ts)                                     | Result type, pointer escaping and shared structural checks.                                                                  |
| [validate-manifest.ts](validate-manifest.ts)                       | Manifest structure and document-local invariants.                                                                            |
| [validate-template.ts](validate-template.ts)                       | Template structure and document-local invariants.                                                                            |
| [validate-expression.ts](validate-expression.ts)                   | Closed expression syntax, including every conditional branch.                                                                |
| [in-memory-definition-catalog.ts](in-memory-definition-catalog.ts) | Validated definition indexing, snapshots, exact lookups and conflict checks.                                                 |
| [resolve-definitions.ts](resolve-definitions.ts)                   | Compatibility checks across the requested system and template.                                                               |
| [plan-calculations.ts](plan-calculations.ts)                       | Reference discovery, cycle detection and dependency order for a structurally validated template.                             |
| [calculate-base.ts](calculate-base.ts)                             | Full base-calculation validation and evaluation over a template and supplied inputs.                                         |

## Calculation rules

Supported operations are `constant`, `field`, `floor`, `divide`, `multiply`, `equal` and `if`. They form a data-defined expression tree. Every reference must name an input or derived field in the same template.

Both conditional branches contribute dependencies and undergo syntax and type checks. Evaluation executes only the selected branch. Derived fields must produce numbers, with boolean expressions permitted as conditional tests.

Numbers follow the v1 finite binary64 and safe-integer rules. Division by either signed zero fails. Every evaluated numeric intermediate is checked, negative zero becomes zero, and `floor` provides the explicit rounding operation.

Inputs must contain exactly the declared own keys, with safe integer values inside their inclusive bounds. Template defaults describe initialization. Callers must supply a complete input map to calculate.

## Boundaries and upcoming work

Domain modules depend on other domain modules. Filesystem access, Electron, React and concrete logging infrastructure belong outside this directory. The application layer will obtain definitions and source values, invoke domain operations, and present results or diagnostics.

| Capability                                                              | Current status                                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definition structure validation, in-memory catalog and exact resolution | Implemented.                                                                                                                                                         |
| Dependency analysis and base expression evaluation                      | Implemented.                                                                                                                                                         |
| Instance-entry effect application                                       | Next phase. The v1 contract specifies target validation, conflict rejection and one multiplication after the target's base formula, before downstream consumers run. |
| Instance creation, editing and complete saved-instance validation       | Planned in later roadmap phases.                                                                                                                                     |
| Library discovery, selected-system loading and persistence              | Planned in later roadmap phases.                                                                                                                                     |
| Reusable feature library and selection provenance                       | Requires its own future specification. Current entries are instance-owned snapshots.                                                                                 |

For the authored Ork, base Toughness Bonus is 4 at Toughness 45. Its selected Unnatural Toughness effect will produce 8 when effect application is implemented. The base-calculation API currently returns 4.

The Python contract verifier still supports fixture checks and effect arithmetic acceptance. Retire overlapping arithmetic tracing when the TypeScript effect coverage is available, as recorded in the Phase 9 plan.

## Verification and maintenance

Source tests mirror the domain modules under [tests/unit/domain](../../tests/unit/domain/). The dependency boundary test checks domain imports. Calculation tests use independent expected results for the character and monster examples, edited scores, numeric boundaries and failure paths.

Run `npm run test:unit` and `npm run typecheck` for domain changes. Run `npm run format:check` for documentation formatting. Follow the active phase's validation document for additional required checks.

When changing a public domain operation, update its module entry, flow and example here as needed. Keep implementation status explicit and preserve the distinction between stored source state and recomputed results. Detailed decisions and validation evidence remain in the phase specifications.
