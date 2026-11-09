# Phase 15 validation

Run commands from the repository root with locked Node dependencies and the contract Python environment described in the [contract README](../../data_contracts/README.md).

| Check                                                   | Method and expected result                                                                                                                                                                                                                                                     | Status | Evidence                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 — Stored sheet contract (SS-1 through SS-3, SS-6)    | Run `python data_contracts/verify_contracts.py` in the contract environment. Both v2 roles validate standalone and with exact definitions. Malformed fields, layout, values and entries fail. Source-only v1 returns version-specific guidance.                                | Passed | 2026-11-07. All 14 groups passed. Standalone and exact-definition checks preserved a deliberately different recorded result. V1 returned recreation guidance. V2 accepted Gregorian year `0000` and rejected an invalid leap day. |
| V2 — Static and formatting checks (SS-6, SS-7)          | Run `python -m mypy --strict --no-namespace-packages data_contracts/verification data_contracts/verify_contracts.py`, `npm run typecheck`, `npm run format:check` and `git diff --check`. All exit successfully.                                                               | Passed | 2026-11-07. TypeScript, mypy (11 source files), Prettier and the Git whitespace check passed.                                                                                                                                     |
| V3 — Domain suite (SS-4, SS-5, SS-7)                    | Run `npm run test:unit`. Both roles initialize final results. Source and effect edits publish final results with edited values. Descriptive/equivalent edits skip evaluation and retain the stored values. Invalid edits and calculation failures preserve the prior instance. | Passed | 2026-11-07. All 363 tests passed across 16 files. Tests cover failed initial calculation, arithmetic and clock failure recovery, and calculator calls skipped on descriptive and equivalent edits.                                |
| V4 — Rogue Trader walkthrough (SS-3 through SS-5, SS-7) | Inspect the v2 example sheets using the procedure below and run the Step 2 domain acceptance scenarios for the edit outcomes.                                                                                                                                                  | Passed | 2026-11-07. Inspected both fixtures and ran the focused walkthrough suite. All 102 tests passed. The Ork retained 10 after a failed edit, then stored 5 after effect removal.                                                     |

## Walkthrough

1. Open the [Explorator](../../data_contracts/examples/v2/explorator.instance.json) and [Ork](../../data_contracts/examples/v2/ork-freebooter.instance.json) sheets. In each, locate the Bonuses section and the Toughness Bonus label. Read the stored values of 3 and 8, respectively. The Ork's entry retains its multiplier of 2. Under Movement, locate Half Move and its unit, metres/round.
2. With the exact runtime definitions in the in-memory catalog, create a character and a monster. Verify distinct IDs, default source values, and the initial Half Move of 0.5.
3. From the authored Ork, set Toughness to 50. Verify that the returned sheet contains Toughness 50 and Toughness Bonus 10. Try setting Toughness to 100 and verify the failure preserves 50 and 10. Remove Unnatural Toughness from the last valid sheet and verify Toughness Bonus 5.
4. Rename the sheet or repeat the same source edit. Verify the stored result remains 5 and consult the focused test for evidence that evaluation was skipped. Verify that the Explorator still has its original results.

Item 1 is a fixture inspection. To reproduce items 2–4 against the runtime definitions and the domain API, run:

```powershell
npm run test:unit -- tests/unit/domain/rogue-trader-runtime-definitions.test.ts tests/unit/domain/create-instance.test.ts tests/unit/domain/edit-instance.test.ts
```

Filesystem and UI walkthroughs belong to later phases.

## Versioned bundle follow-up

On 2026-11-07, the verifier passed all 14 contract groups using each bundle's own schemas and fixtures. SHA-256 comparisons confirmed that the copied system and template schemas and example definitions are byte-identical across v1 and v2. A repository search found no references to the former unversioned example paths. All 363 unit tests, TypeScript, mypy, formatting and the Git whitespace check passed after the move.

The lockstep follow-up superseded the identical-schema layout on 2026-11-07. Structural comparison confirmed that the system and template schemas differ only at `schemaVersion`. The active `1.0.1` definitions preserve the rules and presentation from `1.0.0`, and the earlier runtime archive files are unchanged. The domain suite resolved both exact revisions in one catalog. All 364 unit tests, 15 contract test groups, TypeScript, mypy, formatting and the Git whitespace check passed.
