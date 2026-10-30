# Phase 6: Domain module foundation - Validation

Defined before implementation on 2026-10-30.

| ID  | Requirements | Method and expected result                                                                                                                                                                                                                             | Status | Evidence                   |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------- |
| V1  | DF-1         | Run `npm run typecheck`; declarations and existing application compile without errors.                                                                                                                                                                 | Passed | See step 1 evidence below. |
| V2  | DF-1         | Inspect declarations against the three JSON schemas and normative contracts, including recursive expressions, optional metadata, open categories, role distinction and all diagnostic codes. No runtime guarantees claimed.                            | Passed | See step 1 evidence below. |
| V3  | DF-1, DF-3   | Run `npm run format:check` and `git diff --check`; inspect `src/domain/` for forbidden imports, runtime behavior and game-specific rules. Exactly three files in this phase folder.                                                                    | Passed | See step 1 evidence below. |
| V4  | DF-2         | Run the focused Vitest command added in step 2 and compile-time cases through TypeScript; both instance fixtures share exact definitions and retain distinct roles/values and instance-owned effects. Literal discriminants reject unsupported shapes. | Passed | See step 2 evidence.       |
| V5  | DF-2         | Run `.venv-contracts/Scripts/python.exe data_contracts/verify_contracts.py`; existing contract and arithmetic fixture verification passes without fixture changes.                                                                                     | Passed | See step 2 evidence.       |
| V6  | DF-3         | Run automated domain import boundary checks in the unit suite; domain has no framework, filesystem, network or concrete logging dependencies.                                                                                                          | Passed | See step 2 evidence.       |

## Supplementary human walkthrough

After step 1, read `src/domain/common.ts`, `expressions.ts`, `documents.ts` and `diagnostics.ts` alongside the schemas and normative contracts. Trace an instance's exact system/template references, editable values and entry effects; note that types cannot validate strings, numeric bounds or cross-document references. Review the recursive expression discriminants without expecting evaluation code.

After step 2, run the documented focused unit command. Inspect `data_contracts/examples/system.json`, `templates/creature-core/1.0.0/template.json`, `explorator.instance.json` and `ork-freebooter.instance.json`. Confirm both roles share the creature template, and the Ork's modifier belongs to its entry. Inspect the tests' explicit expectations and test-only loading boundary.

Human execution: Not run. No interface changes; interface accessibility checks are not applicable.

## Step 1 evidence - 2026-10-30

- V1 Passed: `npm run typecheck` exited 0 with the new declarations included by the existing strict project configuration.
- V2 Passed: inspected all properties and required/optional distinctions against the manifest, template and instance schemas. Expression covers all seven operations, with recursive children; semantic operand checking is deferred. All 19 normative diagnostic codes and optional related locations are represented. Entity types/categories remain strings; instance role is a separate union. No extra feature-library fields or persisted derived values were introduced.
- V3 Passed: `npm run format:check` and `git diff --check` exited 0. Inspection found only type/interface exports and two relative type-only imports in src/domain; no runtime logic or framework, filesystem, network or logging-backend imports. Phase folder contains only plan.md, requirements.md and validation.md.

The four declaration modules are common.ts (references/metadata), expressions.ts (syntax union), documents.ts (manifest/template/instance and owned entries/effects), and diagnostics.ts (codes/locations/messages). No assertions about runtime validity are made. Unit harness, automated boundary checks and Python verification remain for step 2. Human review is pending; the phase is not complete.

## Step 2 evidence - 2026-10-30

User reviewed step 1 and authorized continuation. Phase completion evidence:

- V1/V4 Passed: `npm run typecheck` exited 0, including Vitest configuration, fixture consumers and compile-time discriminant checks. Negative cases require rejection of unsupported roles, incomplete binary expressions, executable nodes, additive effects and unknown diagnostic codes. `expectTypeOf` checks also compile through TypeScript; Vitest transpilation alone is not claimed as type checking.
- V4/V6 Passed: `npm run test:unit` reported **3 files, 6 tests passed**. Four cases inspect exact fixture references, ordered fields/defaults, distinct source values, instance-owned effects and independent fixture loads. One covers type contracts; one parses every domain TypeScript file with existing Babel support to restrict top-level statements to declarations and imports to domain-local type-only dependencies. It found no runtime framework/filesystem dependencies. This foundation guard intentionally needs revision when later phases add runtime domain behavior.
- V5 Passed: `.venv-contracts/Scripts/python.exe data_contracts/verify_contracts.py` reported **22 tests, OK**, including existing independent arithmetic and invalid-data scenarios. No fixture/schema/Python source changes. Python arithmetic remains until production calculation coverage replaces it.
- V3 Passed: formatting and diff checks passed after final documentation updates. README records the focused command, type-check requirement, test-loader limits and human walkthrough. Roadmap marks only Phase 6 newly complete; Phase 7 is next.

Environment: Windows x64, Node 26.13.0, npm 12.2.1. Added exact dev dependency Vitest 5.0.5; npm resolved Vite 8.3.5 as its required peer. [Official Vitest guidance](https://vitest.dev/guide/) and npm package engine metadata were checked: the installed Node version is supported. Lockfile comparison found zero existing package version changes or removals; 46 new entries include optional platform tooling. npm audit reports four moderate findings in the existing Forge/webpack-dev-server/sockjs/uuid chain, with none attributed to Vitest; no unrelated dependency remediation was performed.

Initial boundary test failed because TypeScript 7 exposes no compiler parsing API. Replaced that test's parser with the already installed Babel core and TypeScript preset; no added parser dependency or compiler downgrade. Final unit tests and strict type checking passed.

The unit loader's generic casts are explicitly test-only. These tests neither validate arbitrary JSON nor execute calculations, dependency resolution or effects. No application runtime/build behavior changed; packaging and Electron smoke tests were not rerun for this declaration/test-only phase. Human walkthrough remains Not run and supplementary.
