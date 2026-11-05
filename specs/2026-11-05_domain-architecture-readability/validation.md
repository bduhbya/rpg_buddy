# Phase 13 validation

Run from the repository root with the locked Node dependencies and the contract verification environment installed. Run V1–V4 at each checkpoint.

| ID  | Requirements     | Procedure and expected result                                                                                                                                                                             | Status                 |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| V1  | DR-2, DR-3       | Run `npm run test:unit`. Existing exact-version, duplicate, provider, effect, numeric and dependency-boundary tests pass.                                                                                 | Passed (Steps 1 and 2) |
| V2  | DR-2, DR-3       | Run `npm run typecheck`. All callers compile against the owning modules.                                                                                                                                  | Passed (Steps 1 and 2) |
| V3  | DR-2, DR-3       | Run `.venv-contracts/Scripts/python data_contracts/verify_contracts.py`. All schema and fixture checks pass.                                                                                              | Passed (Steps 1 and 2) |
| V4  | DR-1, DR-2, DR-3 | Run `npm run format:check` and `git diff --check`. Inspect moved modules, existing exports and updated guide links.                                                                                       | Passed (Steps 1 and 2) |
| V5  | DR-1, DR-3       | Trace catalog construction, exact lookup and compatibility checks, then follow creation through providers to independent source defaults. Compare with the existing catalog, resolver and creation tests. | Passed (Step 1)        |
| V6  | DR-1, DR-3       | Trace effect-aware calculation through validation, dependency order, base evaluation, multiplication and downstream references. Compare with the existing calculation and effect tests.                   | Passed (Step 2)        |

## Step 1 evidence — 2026-11-05

- V1 passed. Vitest ran 311 tests in 15 files, including the recursive dependency-boundary check and the existing public entry points.
- V2 and V3 passed. TypeScript reported no errors and the Python verifier passed all 10 contract checks.
- V4 passed. Prettier and Git whitespace checks passed. All 29 local links in the phase specs and architecture guide resolved. Reviewed the public forwarding exports and the internal imports into the new folders. The calculation changes in this step are import path updates.

### Resolution and creation walkthrough

1. Start in [the catalog](../../src/domain/definition-processing/in-memory-definition-catalog.ts) at `createInMemoryDefinitionCatalog`. Each parsed definition goes through its structural validator before registration. The catalog indexes manifests by ID and version, and templates by system ID, template ID and template version. A conflicting duplicate fails construction. The [catalog tests](../../tests/unit/domain/in-memory-definition-catalog.test.ts) show that returned lookups are independent copies and that an unavailable version cannot fall back.
2. Follow [the resolver](../../src/domain/definition-processing/resolve-definitions.ts) from request validation through the two exact lookups. A successful lookup establishes availability. The resolver then checks manifest membership and exact system identity/version agreement. The [resolver tests](../../tests/unit/domain/resolve-definitions.test.ts) cover an archived exact match, a system-version mismatch and unrelated manifest members.
3. Follow [instance creation](../../src/domain/instances/create-instance.ts) from the closed request and role check through resolution, ID validation and UTC time validation. Successful creation builds its own reference objects, input map and entries array, with one timestamp for both date fields. The [creation tests](../../tests/unit/domain/create-instance.test.ts) cover independent state and provider failures.

Step 1 review follow-up removed the root creation wrapper and updated both callers. All 311 unit tests, 10 contract checks, TypeScript, Prettier and Git whitespace checks passed again.

The second review follow-up removed the four root definition wrappers. Current callers and the README use the owning definition modules directly. All 311 unit tests, 10 contract checks, TypeScript, Prettier and Git whitespace checks passed.

The Step 1 documentation follow-up added JSDoc to all 14 exported domain functions. All 311 unit tests, 10 contract checks, TypeScript, Prettier and Git whitespace checks passed.

The folder follow-up moved shared definition patterns into definitions and grouped calculation and effects under calculation. The 311 unit tests, 10 contract checks, TypeScript, formatting and Git whitespace checks passed. All 36 architecture and phase links resolved.

## Step 2 evidence — 2026-11-05

- V1 passed. The six calculation and effect suites passed 132 focused tests. The full suite passed all 311 tests in 15 files.
- V2–V4 passed. TypeScript reported no errors, all 10 Python contract checks passed, and Prettier and Git whitespace checks passed. The staged review baseline was preserved.

### Calculation with effects walkthrough

1. Start at [calculateWithEntries](../../src/domain/calculation/calculate-with-entries.ts). It passes a located template, complete input map, and entry array to the [shared engine](../../src/domain/calculation/calculation-engine.ts). The engine revalidates template structure, [plans field dependencies](../../src/domain/calculation/plan-calculations.ts), and [validates and indexes effects](../../src/domain/calculation/validate-entry-effects.ts) before checking expression types and input values.
2. In the engine's evaluation loop, follow one field from its base expression through any [registered effect](../../src/domain/calculation/effect-operations.ts). The engine checks the modified number, then stores the final value in both the dependency cache and the returned results. An invalid modified number points to the effect's factor and includes the original template expression as a related location.
3. In the [effect-aware tests](../../tests/unit/domain/calculate-with-entries.test.ts), find the case with reversed declarations. Strength Bonus evaluates to 4, then becomes 8 after its multiplier. Toughness Bonus reads 8 and becomes 24 after its own multiplier. Agility Bonus reads 24, which also reaches the movement formulas. The same suite verifies that invalid effects fail before arithmetic and that repeated runs do not compound effects.
