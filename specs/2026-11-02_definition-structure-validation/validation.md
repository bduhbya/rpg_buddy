# Phase 7: Definition structure validation - Validation

Defined before implementation on 2026-11-02. Run step-relevant checks at each checkpoint.

| ID  | Requirements | Method, preconditions and expected result                                                                                                                                                                                                                                                          | Status | Evidence |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| V1  | DS-1, DS-2   | `npm run test:unit`: valid manifest/template fixtures accepted; missing/extra properties, malformed nested values, versions, patterns, duplicates and local invariants rejected at useful pointers. Assert no partial value, coercion or mutation. Step 1 covers manifests; step 2 adds templates. | Passed |          |
| V2  | DS-1, DS-2   | `npm run typecheck`: all source/tests compile; discriminated result narrows to validated document only on success.                                                                                                                                                                                 | Passed |          |
| V3  | DS-3         | Unit boundary test plus inspection: domain imports remain within domain, no framework/filesystem/network/backend imports or dynamic external loading.                                                                                                                                              | Passed |          |
| V4  | DS-1, DS-3   | `.venv-contracts/Scripts/python.exe data_contracts/verify_contracts.py`: unchanged schemas/fixtures and independent contract examples pass.                                                                                                                                                        | Passed |          |
| V5  | DS-3         | `npm run format:check`, `git diff --check`, inspect schema/contract parity and phase folder: all pass and exactly the three required Markdown documents exist.                                                                                                                                     | Passed |          |

## Supplementary human walkthrough

Run the unit suite from the repository root. Inspect the manifest validator alongside `data_contracts/v1/system.schema.json`; follow a malformed template reference to its diagnostic pointer, and note that different versions of one ID are allowed. Inspect result narrowing and the input-preservation tests. After step 2, inspect template validation against its schema and trace nested expression diagnostics, bounds and section membership. Confirm expression field existence/types/cycles and cross-document membership remain later checks.

Human walkthrough: Not run; supplementary, not a completion gate. No UI changes. No persistence/recovery checks apply because these pure validators neither load nor save state.

## Step 1 evidence - 2026-11-02

- V1 Passed for step 1: `npm run test:unit` reports **4 files, 34 tests passed**. Manifest cases cover the authored fixture, all missing top-level required properties, non-object roots, unsupported versions, invalid identifiers/version strings/labels, malformed source and template references, unknown nested properties, escaped `~` and `/` pointer segments, duplicate pairs with related locations and distinct versions of one template ID. Frozen valid input and snapshot comparisons verify preservation. Failures expose no value. Template checks remain Not run/unimplemented.
- V2 Passed: `npm run typecheck` exited 0. A test fixture assignment initially failed strict typing; using an object spread for the deliberately malformed record resolved it. Final strict checking includes narrowed success/failure consumers.
- V3 Passed: the revised AST boundary check traverses runtime bodies and checks imports/re-exports remain domain-local, while rejecting dynamic imports and direct require/eval/Function/network calls. Inspection of the new code confirms no infrastructure dependencies or side effects. This is an architectural guard, not a sandbox against arbitrary adversarial JavaScript.
- V4 Passed: existing Python contract verifier reported **22 tests, OK**; schemas, fixtures and Python sources unchanged.
- V5 Passed for step 1: formatting and diff checks passed; inspected manifest checks against every property of the v1 system schema and normative pair-uniqueness rule. This phase folder contains only plan.md, requirements.md and validation.md. Template parity inspection remains for step 2.

Implementation flow: `src/domain/validate-manifest.ts` creates call-local `DefinitionChecks` from `src/domain/validation.ts`, checks closed object shapes and scalars, then checks template pair uniqueness before returning the discriminated result. The sole type assertion is inside the result helper, after validation; it is not itself validation. Successful values alias the original input and require revalidation after later mutation. Neither manifest membership nor referenced template existence is resolved here.

Human review: pending. Phase remains incomplete. Next step, after authorization: template/metadata/expression structure checks and local template invariants, followed by final phase validation. No application integration changed; packaging/smoke tests were not run.

## Step 1 review revision - 2026-11-02

User requested named regular expression constants. Extracted nonblank text, slug, definition version and source SHA-256 patterns into `src/domain/definition-patterns.ts`, shared by both validators. JSON Pointer escaping uses literal `replaceAll` calls. Patterns and validation behavior remain unchanged. TypeScript checking, all 34 unit tests, formatting and diff checks passed after the revision. Step 2 remains pending authorization.

## Step 1 review revision: test layout - 2026-11-02

User requested mirroring source directories under tests/unit. Moved existing domain tests and their fixture loader into `tests/unit/domain/`. Manifest validation now uses `validate-manifest.test.ts`, fixture document coverage uses `documents.test.ts`, and aggregate type/boundary checks use `types.test.ts` and `boundary.test.ts`. Updated relative source imports and test-only fixture/domain-root URLs; the existing recursive Vitest include remains sufficient. README records the convention. This is a layout-only revision; step 2 remains pending authorization.

Layout revision verification: all 34 tests across 4 files passed; strict TypeScript, repository formatting and diff checks passed. Fixture loading and domain boundary discovery work from the new directory.

## Step 2 and phase completion evidence - 2026-11-02

User explicitly authorized step 2 after reviewing the first step and its requested revisions.

- V1 Passed: `npm run test:unit` reports **5 files, 103 tests passed**. Template tests accept the authored definition with every nested object frozen, check original identity, and assert failed validation preserves snapshots and exposes no partial value. Cases cover every required top-level and input/derived property, malformed sections, labels, field ID formats/length, citations, field types, unit, optional/empty/closed metadata at all three supported locations, safe integer bounds/defaults, duplicate field/section IDs, missing/repeated/unknown section members and input/unknown/repeated modifier targets. All seven expression forms are accepted structurally; malformed nested nodes, unsupported operations, extra keys, nonfinite/unsafe constants and invalid nodes in an if branch are rejected at precise pointers. Explicit tests accept unresolved references, cycles, wrong condition/final expression types and division by zero structurally, proving these checks are deferred rather than silently evaluated.
- V2 Passed: `npm run typecheck` exited 0 with all five test files and domain source included.
- V3 Passed: recursive AST domain boundary check passes with internal runtime imports; inspection confirms pure synchronous logic, named regex constants, no external dependencies, filesystem, network, framework or concrete logger.
- V4 Passed: `.venv-contracts/Scripts/python.exe data_contracts/verify_contracts.py` reported **22 tests, OK**. No schemas, fixtures, Python verifier or calculation tracing changed.
- V5 Passed: repository formatting and diff checks pass. Inspected all required/optional system/template schema properties, seven expression alternatives and normative local invariants against the implementation. Exactly three Markdown files in this phase folder. No dependency or application integration changes.

Code flow: `validateTemplate` checks document identity, metadata and field declarations, then section memberships and modifier targets. `checkField` validates field-specific contracts and bounds; `checkExpression` checks all nested branch shapes without evaluation. Shared checks handle scalar/reference/metadata constraints and assemble diagnostics. No new game-specific rules are encoded. Named patterns remain in definition-patterns.ts; mirrored tests remain under tests/unit/domain.

README documents both public entry points, result narrowing, logical document pointers, input aliasing and the structural/semantic boundary. Roadmap marks Phase 7 complete; Phase 8 Definition dependency resolution is next. Both requested review steps are implemented; no further implementation begins without a new phase specification. Human walkthrough remains Not run and supplementary. No UI, persistence or runtime build changes, so packaging, Electron smoke, accessibility UI and recovery checks are not applicable to this phase.
