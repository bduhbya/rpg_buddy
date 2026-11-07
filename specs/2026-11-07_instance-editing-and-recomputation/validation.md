# Phase 14 validation

Run commands from the repository root with installed dependencies and the contracts virtual environment.

| Check                                       | Method and expected result                                                                                                                                                                                                            | Status                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| V1 Source editing (IR-1, IR-3 through IR-6) | Run `npm run test:unit -- tests/unit/domain/edit-instance.test.ts`. Expect single-operation edits, text and career behavior, exact resolution, existing effects, no-op behavior, diagnostics, failure isolation and recovery to pass. | Passed. 49 focused edit tests.                      |
| V2 Entry editing (IR-2 through IR-6)        | Run the same focused suite. Expect add, replace and remove, malformed JSON and duplicate keys, missing and duplicate IDs, effect conflicts and invalid calculations to be covered.                                                    | Passed. Entry checks are in the focused edit suite. |
| V3 Runtime walkthrough (IR-7)               | Run the [runtime definition suite](../../tests/unit/domain/rogue-trader-runtime-definitions.test.ts) and follow the walkthrough below. Expect only the edited instance to change.                                                     | Passed. 14 runtime tests.                           |
| V4 Repository checks (IR-7)                 | Run `npm run test:unit`, `npm run typecheck`, `.venv-contracts/Scripts/python data_contracts/verify_contracts.py`, `npm run format:check` and `git diff --check`. Expect all to pass.                                                 | Passed after the API simplification.                |

All checks are required for completion. The phase changes the domain only. Separate human execution of the walkthrough is optional.

## Reproducible walkthrough

1. Run `npm run test:unit -- tests/unit/domain/edit-instance.test.ts tests/unit/domain/rogue-trader-runtime-definitions.test.ts`.
2. In [runtime acceptance](../../tests/unit/domain/rogue-trader-runtime-definitions.test.ts), find “edits one instance through the domain API and preserves the other.” The Ork starts at Toughness 45 with Unnatural Toughness ×2. The edit sets Toughness to 50, producing Toughness Bonus 10.
3. Check that setting Toughness to 100 fails at the Toughness input. The last valid instance still holds Toughness 50 and the entry, and its bonus remains 10. Remove the entry in a separate call to recalculate the bonus to 5.
4. Check that the original Ork and Explorator source records still match their snapshots and that the Explorator's results match the worked example. Follow the [domain guide](../../src/domain/architecture.md) from operation to candidate to result.
5. In the [focused edit suite](../../tests/unit/domain/edit-instance.test.ts), follow the add, replace and remove test. With Strength 50, adding the ×2 snapshot produces Strength Bonus 10, replacing it with ×3 yields 15, and removing it restores 5.

## Step 1 evidence

On 2026-11-07, 27 focused tests and all 338 unit tests across 16 files passed. TypeScript, all 10 contract integrity checks, formatting and whitespace checks passed.

The source-edit tests cover numeric and text edits, career removal, equivalent patches, exact-version failures, and rejecting writes to derived fields. With the existing Ork entry, changing Toughness from 45 to 50 produced a Toughness Bonus of 10. A source edit that would overflow an existing effect returned a located diagnostic and preserved the last valid source data and results. A retry from that state succeeded. Clock tests cover thrown errors, invalid calendar dates, earlier times and equivalent timestamps with different fractional precision.

The [edit operation](../../src/domain/instances/edit-instance.ts) and [domain guide](../../src/domain/architecture.md) are ready for Step 1 review. Entry mutation and the combined runtime walkthrough are pending Step 2.

During Step 1 review, the shared [UTC timestamp helper](../../src/domain/definitions/utc-timestamp.ts) moved to definitions, and both regexes became named constants in the shared definition patterns. The anchored pattern covers the complete string, so the extra matched-length guard was removed. The calendar round trip still rejects impossible dates. All 338 unit tests, TypeScript, the 10 contract checks, formatting and whitespace checks passed after the refinement.

## Step 2 evidence

On 2026-11-07, the combined edit and runtime command passed 57 tests across two files. The full suite passed 355 tests across 16 files. TypeScript and all 10 contract checks passed, as did formatting and whitespace checks.

Both Step 1 fixture mutations now identify the Unnatural Toughness snapshot by ID and its effect by target. Step 2 verifies entry add, replacement and removal, equivalent replacements, independent ownership, invalid operation shape, duplicate and missing IDs, unsupported targets, conflicts, unsafe arithmetic and recovery. The runtime case verifies an effect change on one instance while a second instance retains its source state and results. The walkthrough is documented for optional human execution.

## Adversarial review follow-up before the API simplification

The edit API now rejects non-record source maps and takes a plain-data snapshot before validation. Calculation uses the same source values and entries returned on success. Seven regression cases cover Map and Date source values, accessor-backed values and effects, a hidden entry ID, WeakMap metadata, and sparse metadata arrays. The focused suite passed all 50 tests. The full suite passed 362 tests across 16 files. TypeScript, all 10 contract checks, formatting and whitespace checks passed.

A second review follow-up added five regression cases for Maps with plain-record prototypes, sparse array proxies that misreport length, and a genuine null-prototype record. Both invalid input shapes now produce diagnostics. The focused suite passed all 55 tests, and all 367 unit tests, TypeScript, the 10 contract checks, formatting, and whitespace checks passed. The runtime README now distinguishes implemented in-memory operations from planned application integration.

The third review follow-up builds the edit snapshot from the property descriptors it validates. The self-removing proxy regression confirms that a later trap cannot cause an earlier field's replacement getter to run. The Map and sparse-array proxy cases still pass. The focused edit and runtime suites passed 70 tests. The full suite passed 368 unit tests, and TypeScript, all 10 contract checks, formatting, and whitespace checks passed.

The fourth review follow-up rejects proxies before reading descriptors, using a trap-free detector supplied by the caller alongside the clock. The new regressions cover a nonempty sparse effects proxy and a proxied Map. Both return diagnostics before any trap runs, and the existing self-removing proxy, sparse-array proxy, and Map cases still pass. The focused edit and runtime suites passed 72 tests. The full suite passed 370 unit tests, and TypeScript, all 10 contract checks, formatting, and whitespace checks passed.

The fifth review follow-up uses the Node container classifier for native built-in brands and plain data from other realms. Eight additional cases cover prototype-stripped Sets, WeakMaps, Dates, boxed numbers and array buffers, replacement metadata, a cross-realm patch with effect arrays, and a record with a proxied prototype. The existing proxy and Map regressions passed. The focused edit and runtime suites passed 80 tests. All 378 unit tests, TypeScript, all 10 contract checks, formatting, and whitespace checks passed.

The sixth review follow-up checks WeakRef, FinalizationRegistry, and URL native state and detects stripped native objects such as array iterators when they have no own fields. Prototype classification uses intrinsic identities from trusted realm setup. Added five cases and extended cross-realm coverage to remove both constructor descriptors. The existing proxy and Map cases passed. The focused edit and runtime suites passed 85 tests. All 383 unit tests, TypeScript, all 10 contract checks, formatting, and whitespace checks passed.

## Single-operation API evidence

The user approved one operation per call with primitive scalar arguments and entry JSON text. The runtime classifier and realm registration were removed. The focused suite covers rejection of multiple operations and live objects without reading proxy traps, malformed and duplicate-key JSON, and valid escaped text and repeated keys across separate JSON objects. The runtime walkthrough edits one source value, rejects an out-of-range edit, and removes an entry in a separate call.

The focused edit and runtime suites passed 62 tests. All 360 unit tests, TypeScript, all 10 contract checks, formatting, and whitespace checks passed.

The duplicate-key scanner now walks the JSON text iteratively after syntax validation. The 10-million-character description regression reproduced a stack overflow before the fix and passed afterward without adding a schema limit. All eight focused JSON cases, all 361 unit tests, TypeScript, all 10 contract checks, formatting, and whitespace checks passed.
