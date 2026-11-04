# Validation

Executed on Windows on 2026-11-04 unless otherwise stated.

| Check                     | Method and expected result                                                                                                                                                                                                                                           | Status and evidence                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| BC-1                      | Unit tests order prerequisites and reject missing references and cycles, including alternate branches.                                                                                                                                                               | Passed. Step 1 recorded 4 graph cases. Step 2 also exercises ordering and graph errors through calculateBase. |
| BC-2, BC-3                | Independent base expectations for character/monster, edited scores and six numeric boundaries. Reject malformed operations, invalid operands/inputs, unsafe/nonfinite numbers and division by signed zero. Confirm lazy evaluation and recovery after invalid input. | Passed. Full unit suite has 187 passing tests in 9 files, including 54 new evaluation cases.                  |
| TypeScript                | npm run typecheck                                                                                                                                                                                                                                                    | Passed.                                                                                                       |
| Contracts                 | .venv-contracts/Scripts/python data_contracts/verify_contracts.py                                                                                                                                                                                                    | Passed. 22 test groups.                                                                                       |
| Python types              | .venv-contracts/Scripts/python -m mypy --strict --no-namespace-packages data_contracts/verification data_contracts/verify_contracts.py                                                                                                                               | Passed. 12 source files.                                                                                      |
| Desktop build             | npm run package                                                                                                                                                                                                                                                      | Passed. Windows x64 package built.                                                                            |
| Desktop regression        | npm run test:smoke                                                                                                                                                                                                                                                   | Passed. 43 tests passed, 7 existing project-specific skips.                                                   |
| Formatting and whitespace | npm run format:check and git diff --check                                                                                                                                                                                                                            | Passed. Final documentation check also passed.                                                                |

## Reproducible human walkthrough

Precondition. Use the repository's declared Node/npm versions and installed dependencies from the repository root.

1. Read [calculate-base.ts](../../src/domain/calculate-base.ts). Follow template validation, dependency ordering, full-branch type checking, input validation and evaluation. Observe that failure returns diagnostics before results are exposed.
2. Run `npm run test:unit -- tests/unit/domain/calculate-base.test.ts`. Expect all 54 cases to pass.
3. Inspect the first table in [calculate-base.test.ts](../../tests/unit/domain/calculate-base.test.ts). It loads the authored examples through the catalog and exact resolver. Compare the independently stated expectations with the [worked rule examples](../../data_contracts/verification/tests/test_calculations.py). Explorator bonuses are 4/3/3 with movement 3/6/9/18. Ork base bonuses are 5/4/3 with the same movement. Its entry-owned toughness multiplier is Phase 10 work.
4. Inspect the boundary table. Scores 0/9/10/39/40/99 yield bonuses 0/0/1/3/4/9. At zero bonus, movement is 0.5/1/2/3.
5. Inspect alternate-branch errors and arithmetic failure pointers, then the invalid-input/recovery case. Verify that the next valid call produces fresh results.

Status. Automated equivalents passed. Separate human execution has not been reported. Completion requires documenting this procedure, as agreed, rather than a separate human execution result.

## Step 1 history

On 2026-11-03, 133 unit tests passed including 4 focused graph cases, along with type checking, formatting and whitespace checks. The user authorized step 2 on 2026-11-04.

## Remaining transition

The Python tracer remains temporarily for instance-effect acceptance. Phase 10 must move that coverage to TypeScript and retire overlapping tracing. No Python evaluation logic changed in this phase.

## Review correction

The adversarial review identified missing structured cycle participant locations. Corrected DEPENDENCY_CYCLE diagnostics to include related pointers to each participating field ID, once each and excluding any preceding non-cycle fields. The primary pointer still locates the closing reference. Self-cycle, two-field cycle and non-cycle-prefix coverage passed. After this correction, 188 unit tests, TypeScript checking, formatting and git diff --check passed. Desktop and Python checks above were performed before this diagnostic-only correction.
