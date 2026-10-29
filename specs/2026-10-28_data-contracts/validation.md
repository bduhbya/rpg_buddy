# Phase 2: Data contracts - Validation

## Required activities

Original checks were defined before initial schema/example implementation. Revised R-V checks were defined before implementing the user-authorized shared-creature/features revision. The table below records current results; historical checks are summarized separately.

| ID | Requirements | Method and expected result | Status |
| --- | --- | --- | --- |
| R-V1 | DC-1, DC-2, DC-7 | Check Draft 2020-12 schemas with FormatChecker; validate one shared template, manifest and both instances; resolve exact references and entityType independently of role. | Passed |
| R-V2 | DC-3, DC-5, DC-8 | Preserve C1/M1/C2/M2/B1 numeric vectors; check add/remove, simultaneous strength/toughness effects, role/name independence and final-value dependency propagation. | Passed |
| R-V3 | DC-4, DC-7, DC-8 | Reject unknown/input/undeclared targets, invalid factors, duplicate IDs and conflicting effects; accept custom careers/entries and prose without automatic effects. Retain original structural/dependency negative checks. | Passed |
| R-V4 | DC-6 | Inspect constitution/contract/schema/fixture consistency, retired references, three-file phase folder and whitespace; run the reproducible harness. | Passed |

## Reproduction

From repository root, follow [verification setup](../../data_contracts/README.md), then run:

```powershell
.\.venv-contracts\Scripts\python data_contracts\verify_contracts.py
```

This run used Python 3.12 and jsonschema 4.26.0 installed outside the repository in the chat workspace; the README reproduces it in an isolated local environment. No Electron build is needed or claimed.

## Shared-creature revision results - 2026-10-28

- R-V1: All three schemas pass Draft202012Validator.check_schema. The four fixtures (manifest, shared creature template, character instance, monster instance) pass structure and semantic harness checks. Both instances resolve exactly creature-core/1.0.0 and the same rogue-trader manifest; entityType is creature while roles differ. Nine inputs and seven outputs remain. Instance source values preserve C1/M1; the character matched the previous initialization defaults at this checkpoint; the zero-default update below supersedes those defaults. Inspected archived manifest and role-specific canonical path contracts; no filesystem resolver is implemented.
- R-V2: All 17 inherited numeric vectors pass: C1, M1, C2, M2 at T49/T50, and six B1 strength/toughness/agility boundary vectors for each role. Expected numbers are independent literals in the harness. Fourteen feature checks cover simultaneous Strength/Toughness multiplication on a character, repeated evaluation, role/name/category changes, removal, prose-only custom skills/feats, duplicate labels with distinct IDs, Ork trait removal (TB8 -> 4), Ork feature use with character role, floor-before-multiply at 49, downstream final-value propagation, instance/template independence and JSON source-data round-trip/recomputation, and explicit factors 3 and 1. Lazy expression branch evaluation also passes.
- R-V3: 63 negative cases pass, including original input/type/name/time/schema/reference/dependency/cycle/JSON checks and new invalid targets, nonpositive/fractional/string/boolean/nonfinite/unsafe factors, duplicate entry IDs, duplicate target effects within/across entries, unsupported effect operations or extra expressions, blank career, unsupported role, absent entries, invalid/duplicate template target declarations, retired template kind, disabled effect targets and an unsafe computed effect result. The original large-literal case is rejected before arithmetic, not evidence of floating overflow-path execution.
- R-V4: Inspected mission.md, tech-stack.md and roadmap.md against contracts.md, schemas and fixtures. The user explicitly authorized replacing separate character/monster templates and fixed Ork rules with shared structure and instance features, plus free-form user choices. First unpublished v1 draft updated in place; no published library or migration is claimed. Phase 1 numerical facts remain; its representation/exclusion decisions are explicitly superseded in the current contract. No Space Marine profile, new rulebook catalog, legality engine, runtime application, persistence implementation or encounter code added. Only the three required documents remain in this phase folder. Current artifacts live in maintained data_contracts/. Whitespace and retired-reference inspection passed.

Result: `PASS: 3 schemas, 4 JSON examples, 17 numeric vectors, 14 feature checks, 63 negative cases, lazy-branch check.`

The Python verifier is a contract harness, not the production TypeScript engine. Production diagnostic shape/codes, last-valid-state preservation, filesystem resolution/save/backup/recovery and UI accessibility are specified and inspected only; their runtime checks belong to later phases. The in-memory JSON round-trip is not a save/reload or transaction test.

## Human walkthrough

Preconditions: repository checkout and the four JSON examples; no application needed.

1. Open [contract reference](../../data_contracts/contracts.md), then follow the manifest's single template reference into [examples](../../data_contracts/examples/).
2. Compare template inputs/base formulas and both instance values with the approved Phase 1 source-review.md. Both use the same creature-core template; role does not select arithmetic.
3. Inspect the Ork trait's explicit target and factor. At T45/T49 compute floor(T/10)*2 = 8; remove that entry and obtain 4. At T50 with the entry obtain 10.
4. Give the character explicit Strength/Toughness factors; at S41/T35 obtain SB8/TB6. Change role or descriptive names and obtain the same results. Remove effects and return to SB4/TB3.
5. Add a custom career and skill with an empty effects array; prose alone must not alter arithmetic. Duplicate a target effect and expect rejection rather than implied stacking. Check labels, units and plain-language diagnostic requirements without relying on color.
6. Run the verifier using the reproduction command. Compare exact system/template references and role-specific library paths; actual persistence remains future work.

Human walkthrough status: Not run by user; supplied for review and not a completion gate.

## Prior draft evidence

Before the flexible model revision, the original V1-V5 checks passed: three schemas, five examples, 17 vectors, 38 negative cases, lazy branch, contract/constitution inspection and whitespace checks. The same checks passed after the artifact relocation to data_contracts/ and after moving template examples to fixed template.json filenames. Those results concern the superseded two-template draft and are not current fixture counts. No user-executed walkthrough was claimed. Current results above supersede those counts and representation choices.

Phase 2 complete with DC-1 through DC-8 met. Runtime enforcement and the human walkthrough remain explicitly unclaimed.

Base-template naming correction: Passed. defaultDisplayName is Creature; the base template is distinct from named sample instances. The contract harness still passes 3 schemas, 4 JSON examples, 17 numeric vectors, 14 feature checks and 63 negative cases.

## Zero-default and readability revision - planned checks

Before implementing this update: verify all nine defaults are zero and a fresh default instance computes SB/TB/AB 0 and movement (0.5, 1, 2, 3). Preserve C1/M1 and boundary expectations using explicit instance values. Refactor the harness into named tests with labeled invalid cases and named expected outputs, preserving the original 17 numeric vectors, 14 feature checks and 63 negative cases. Run the full script and check that failures identify the scenario. Status: Passed (results below).

## Zero-default/readability revision results - 2026-10-28

Passed: `python data_contracts/verify_contracts.py` reports `Ran 20 tests` and `OK`. These are 20 named test groups with labeled subcases, preserving the previous 17 numeric vectors, 14 feature checks and 63 negative cases; one additional calculation verifies zero-initialized defaults. All nine input defaults are 0. A new unfilled instance computes SB/TB/AB 0, Half Move 0.5, Full Move 1, Charge 2 and Run 3. The stored C1/M1 instance values are unchanged.

The script now separates schema/semantic verification, expression evaluation, expected-statistic helpers and unittest cases. Single-letter names, global counters, dense mutation lambdas and positional seven-result tuples have been replaced with descriptive names, explicit edit tables, docstrings and dictionaries keyed by statistic name. Named subtests report failing scenarios. Rejection tests accept only expected validation exceptions; unexpected KeyError/programming faults fail. Calendar parsing errors are explicitly converted into semantic validation failures. The initial refactor run exposed that conversion requirement; after correction the complete suite passes. No files are written by the verifier and importing it does not run the suite.

The summary now reports unittest group counts rather than manually maintained scenario counters. All schema, dependency, modifier, laziness, instance independence and source-data round-trip obligations from the earlier harness remain. Production runtime/file/UI limitations remain as previously recorded. Inspected reproduction/readability guidance, documentation consistency, UTF-8, whitespace and the three-file phase-folder invariant. Phase 2 remains complete.

## Optional development provenance checks - defined 2026-10-29

Before implementation: verify direct source citations no longer contain phase-register labels, metadata-free template/instance loading and calculations agree, supplied metadata is structurally checked, and metadata text cannot change mechanics. Retain all existing numeric, feature and negative checks. Status: Passed.

## Optional development provenance results - 2026-10-29

Passed: full verifier reports `Ran 22 tests` and `OK`. Two additional named groups validate metadata-free template/instance loading and calculations, inert documentary strings, direct rulebook citations, and malformed metadata rejection at template, input, derived, instance and entry boundaries. All original worked values, zero defaults, feature behavior and negative cases remain covered. Reviewed schema required lists: metadata is optional and top-level template sourceReview is removed. source/sourceRefs hold publication/page citations; sourceReview, sourceRegisterRefs and requirementRefs are nested under metadata. No runtime fetch/resolution of development files occurs. Phase folder still contains only the three specified documents; whitespace checks passed. Production runtime/file/UI checks remain deferred.

Feature-library clarification inspection - 2026-10-29: Passed. Inspected modifierTargets (derived IDs only) and instance entries/effects (self-contained). Confirmed the template has no named feature list, and the new documentation distinguishes future feature-library documents/version provenance from already supported snapshots and optional development metadata. Catalog/origin schemas and selection/update behavior are documented obligations, not implemented or tested features. No schema, fixture or verifier behavior changed; the prior 22-test result remains the latest automated evidence. Checked documentation whitespace and three-file phase-folder structure.

VS Code debugging configuration - 2026-10-29: Passed. Added workspace process tasks to create/install the isolated environment and run the verifier, plus a debugpy launch using that interpreter. Verified configuration JSON, task dependency labels, resolved launch paths and settings against the installed Python Debugger extension schema. Created .venv-contracts (already ignored), installed the pinned verifier requirements and ran all 22 test groups successfully with PYTHONPATH cleared. Ran the zero-default test successfully under the extension's bundled debugpy with a local ephemeral listening port; the final debug configuration disables frozen modules after the initial smoke check reported the interpreter warning. No debugger UI breakpoint/stepping walkthrough was performed; F5 instructions are supplied in data_contracts/README.md. No runtime contract changes.

## Typed verifier refactor checks - defined 2026-10-29

Before implementation: compare the pre/post test method inventory; run all 22 tests and existing focused selector, confirm named invalid subcases and independent expectations survive, run static checking, exercise the unchanged debug interpreter/entry point under debugpy, verify imports do not execute tests, and inspect CLI/docs/phase-folder consistency. Status: Passed.

## Typed verifier refactor results - 2026-10-29

- Passed: all 22 original test methods were extracted into contract, calculation and feature modules. AST comparison of pre/post test bodies after removing type annotations and typing casts is identical, preserving named invalid cases, assertions and independent expected values.
- Passed: original `python data_contracts/verify_contracts.py` runs 22 groups successfully. Standard discovery (`-m unittest discover -s data_contracts/verification/tests -t data_contracts -v`) also runs exactly 22 groups, without duplicates. The existing `ContractTests.test_zero_defaults` selector runs one passing test.
- Passed: strict static checking with mypy 2.4.1 and types-jsonschema 4.26.0.20261006 reports no issues across all 12 source files. Optional tooling is separately pinned in verification-typecheck-requirements.txt; normal verifier setup/tasks retain their runtime-only dependency file. TypedDict/Literal shapes describe validated documents/operations; permissive RawDocument is confined to raw JSON/schema boundaries and intentionally malformed test input. No blanket type-ignore or skipped module check is used.
- Passed: import of the entry point and runner produces no test output. The compatibility suite exposes exactly the original 22 test names. JSON loading resolves relative to the package's location rather than caller cwd.
- Passed: the unchanged VS Code interpreter/program/working-directory settings still resolve. The focused compatibility test passes under the installed debugger with frozen modules disabled. This is a debugger runtime smoke check; no interactive VS Code breakpoint/stepping walkthrough is claimed.
- Inspection passed: no schemas or game-rule fixtures changed in this refactor. README, contract reference and constitution explicitly limit Python to contract verification and bounded acceptance tracing, with production TypeScript acceptance cases sharing independent expectations rather than a second growing implementation. Phase folder retains exactly the three specified documents. Python/mypy caches are ignored; whitespace checks pass.

Implementation detail: semantic validation was separated from expression tracing, with typed casts only after schema validation. Invalid-document boundaries remain runtime checked; type annotations are not treated as validation. New module helpers add no operators or RPG mechanics. Current module map and reproduction/type-check commands are in data_contracts/README.md.
