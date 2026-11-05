# Validation

Run from the repository root with installed dependencies and the existing contracts virtual environment. Planned checks are not evidence.

| Activity                     | Method, expected result and requirements                                                                                                                                                                                                                 | Status                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Focused creation             | `npm run test:unit -- tests/unit/domain/create-instance.test.ts`: IC-1 through IC-5 defaults, roles, exact references, independence, malformed requests, missing versions, invalid/throwing providers, calendar boundaries and recovery pass.            | Passed: 37 tests on 2026-11-04                                 |
| Full units                   | `npm run test:unit`: creation and all existing domain/boundary regressions pass.                                                                                                                                                                         | Passed: 311 tests in 15 files on 2026-11-04                    |
| Types                        | `npm run typecheck`: no errors.                                                                                                                                                                                                                          | Passed on 2026-11-04                                           |
| Contract integrity           | `.venv-contracts/Scripts/python data_contracts/verify_contracts.py`: all integrity groups pass.                                                                                                                                                          | Passed: 10 integrity groups on 2026-11-04                      |
| Formatting                   | `npm run format:check` and `git diff --check`: no issues.                                                                                                                                                                                                | Passed on 2026-11-04                                           |
| Runtime acceptance           | Step 2: creation from maintained runtime JSON through the catalog, followed by production calculation with independently stated expected results; both roles and independent state pass (IC-5, IC-6). Run the focused commands in the walkthrough below. | Passed on 2026-11-05. 13 runtime tests.                        |
| Walkthrough and architecture | Step 2: document reproducible inspection/test steps, expectations and creation flow/provider ownership (IC-6). Separate human execution is not required.                                                                                                 | Passed on 2026-11-05. Walkthrough and architecture documented. |

Step 1 requires the first five activities and then a human review pause. Step 2 requires all activities. Desktop smoke/package checks are not required because this phase changes only the domain and tests, with no application wiring.

## Reproducible walkthrough

1. From the repository root, run `npm run test:unit -- tests/unit/domain/create-instance.test.ts tests/unit/domain/rogue-trader-runtime-definitions.test.ts`.
2. In [runtime acceptance](../../tests/unit/domain/rogue-trader-runtime-definitions.test.ts), follow the blank-sheet case from runtime JSON through the validated catalog to `createInstance`. Check that the character and monster share exact version `1.0.0` references, have distinct IDs, and start as `Creature` with nine zero values and empty entries.
3. Inspect the character mutation and the assertions for the existing monster and the next character. They retain the blank defaults. The calculation assertions expect three zero bonuses and movement of 0.5, 1, 2 and 3 metres per round.
4. In [focused creation tests](../../tests/unit/domain/create-instance.test.ts), inspect invalid requests, unavailable definitions and invalid or throwing providers. Expect located diagnostics, no partial result and successful recovery on a valid call.
5. Follow the [domain architecture flow](../../src/domain/architecture.md) from exact resolution through creation to calculation. Check that the caller supplies unique IDs and UTC time and that calculations are separate from the instance source state.

## Step 1 evidence

Review refinement on 2026-11-05. All 311 unit tests, TypeScript and formatting passed after deriving the role type and creation check from `INSTANCE_ROLES`. The v1 JSON schema and accepted role values are unchanged.

Focused tests cover both roles, an authored nonzero template default, independent identities/reference objects/value maps/entry arrays, exact resolution failures before provider invocation, closed malformed requests, invalid IDs, invalid calendar/time/UTC formats, valid leap days and fractional seconds, provider exceptions with sanitized diagnostics and independent recovery. The API retains no global state; uniqueness across calls is the injected ID provider's responsibility.

Initial 35-test and 309-test runs passed. Two trailing-newline rejection cases were then added. An unnecessary second ID whitespace check produced duplicate diagnostics and failed the new test's exact diagnostic-list assertion; removing that redundant check preserved the shared slug validator's rejection. The final 37 focused and 311 full tests passed. No invalid ID was accepted. TypeScript passed after the final code changes. Python integrity passed all 10 groups; no contracts or Python code changed.

At the Step 1 checkpoint, runtime acceptance, architecture and the walkthrough were pending.

## Step 2 evidence

On 2026-11-05, the focused command in the walkthrough passed 50 tests across creation and runtime definitions. The full unit suite passed 311 tests in 15 files. TypeScript, all 10 Python contract integrity groups, formatting and whitespace checks passed. The initial typecheck found that the negative-test fixture helper exposes effects as `unknown`. The test now adds a valid custom entry directly, and the focused and full suites and typecheck passed after that correction.

The runtime case replaces the earlier test that assembled defaults by hand. It creates both roles from one catalog, checks distinct IDs and complete blank state, mutates one result and verifies that an existing monster and a subsequent character retain their defaults. Both untouched sheets calculate the expected zero bonuses and movement. The walkthrough is documented for optional human execution. IC-6 is complete.
