# Data contracts and fixtures

The [normative contracts](contracts.md) define the data layer. Each supported version bundles its own system, template and instance schemas and a matching set of examples.

| Contract bundle | Schemas    | Examples                    | Instance format |
| --------------- | ---------- | --------------------------- | --------------- |
| v2              | [v2/](v2/) | [v2 examples](examples/v2/) | Complete sheet  |

## Versioning and change history

System, template, and instance schemas advance together. Every schema in `vN/` requires `schemaVersion: N`, and every document authored for `examples/vN/` declares it. When a contract changes, add a complete new bundle and bump all three discriminators. Add a change-history entry here with the changes by document type, any version-only bumps, and which older bundles are supported or retired.

`schemaVersion` identifies the JSON contract. A system or template's `version` identifies an immutable definition revision. Republish a definition under a new revision when its `schemaVersion` changes, and update the exact references in the new bundle.

### v2 — Complete instance sheets

- **Instance.** Added the `derived` map and `presentation` snapshot so a sheet carries its recorded statistics, ordered sections, field labels, and units. A source-only v1 sheet requires recreation in v2.
- **System and template.** Bumped `schemaVersion` to 2. Their structure and rule content are otherwise the same. The Rogue Trader definitions moved to revision `1.0.1`, and v2 examples reference that exact pair.

### v1 — Initial contract (retired before release)

- **System and template.** Defined exact manifest and template references, field constraints, ordered sections, derived expressions, and modifier targets.
- **Instance.** Defined character and monster source values, identity, and entry snapshots with explicit effects.
- **Retirement.** Removed the v1 schemas, fixtures and Rogue Trader `1.0.0` definitions from the current tree. Validators require v2 and reject v1. The earlier files remain in Git history.

Examples are separate from installed runtime content. Earlier phase specs record the paths used at the time.

From the repository root, with Python 3.12 or later:

```powershell
python -m venv .venv-contracts
.\.venv-contracts\Scripts\python -m pip install -r data_contracts\verification-requirements.txt
.\.venv-contracts\Scripts\python data_contracts\verify_contracts.py
```

Keep the local virtual environment out of Git. No application build or Electron installation is needed. This verification-only dependency does not choose the future TypeScript runtime validator.

Both character and monster instances reference the same `creature-core` template. The Ork owns its Unnatural Toughness trait entry and explicit multiplier. User-chosen careers and custom entries are descriptive unless an explicit supported effect is supplied.

The harness checks the schemas and fixtures, exact reference relationships, field and section integrity, types and dependencies, input constraints and entry/effect compatibility. It verifies v2 sheets both independently and against exact definitions. The production TypeScript engine owns arithmetic acceptance. Later phases own runtime diagnostics, filesystem resolution, transaction safety and the UI.

Template examples use `examples/<bundle>/templates/<template-id>/<template-version>/template.json`. The directory ID is descriptive and the definition filename is always `template.json`. The JSON `label` supplies the readable display name.

All nine template attribute defaults are 0. The Explorator and Ork instances retain their own distinct worked values. Feature effects are instance-owned, role-independent, and limited to one multiply effect per declared target.

## Reading the verifier

The script uses Python's standard unittest runner. Normal execution prints the purpose of each named test group, followed by OK or a failure report. Invalid-case tables use named subtests so a failure identifies the exact scenario, such as an invalid calendar date or conflicting effects. Unexpected programming errors do not count as successful invalid-data rejection.

The script is now a small entry point for these typed modules:

```text
verification/
  models.py              TypedDict document shapes and Literal operations
  helpers.py             Strict JSON loading and numeric checks
  validation.py          Schema and cross-document verification
  expressions.py         Expression type, reference and cycle validation
  runner.py              Compatibility suite and unittest command handling
  tests/
    support.py           Fixture loading and malformed-document builders
    test_contracts.py    Structure, identity, provenance and invalid documents
    test_features.py     Snapshot structure, targets and conflicts
verify_contracts.py      Existing CLI and VS Code entry point
```

Read ContractVerifier in validation.py for document checks and the focused test modules for contract integrity scenarios. runner.ContractTests combines the test classes exactly once, preserving retained selectors such as ContractTests.test_schema_and_fixture_links. Test methods start with test_. Fixture copies keep cases independent. Importing the entry point or modules does not run tests. The entry point resolves imports through its script directory, so it also works when invoked by absolute path from another working directory.

Type hints describe validated shapes; JSON Schema and semantic checks still perform runtime validation. RawDocument is intentionally permissive only at JSON/schema boundaries and in tests constructing malformed documents. Domain expressions and validated document access use TypedDict, Literal and explicit parameter/return types.

TypeScript calculation tests cover zero defaults, worked numbers, boundaries, numeric failures and instance effects. They use the authored JSON inputs under `examples/v2/` and specify expected outputs independently.

To run a focused contract integrity check:

```powershell
.\.venv-contracts\Scripts\python data_contracts\verify_contracts.py ContractTests.test_schema_and_fixture_links
```

Run `ContractTests.test_v2_sheet_snapshots` through the same entry point to check both stored sheets. The suite also covers malformed snapshots, v1 rejection by the v2 validator and exact-definition compatibility without evaluation. Use `npm run test:unit -- tests/unit/domain/calculation-engine.test.ts tests/unit/domain/calculate-with-entries.test.ts` for production-engine arithmetic acceptance. Individual Python test groups contain multiple named subcases.

Rulebook citations in source/sourceRefs are self-contained. Optional metadata holds development-only sourceReview, requirementRefs and sourceRegisterRefs; the loader and calculations do not require those development documents. The provenance checks exercise both metadata-free and annotated data.

The feature-library/snapshot design is recorded in contracts.md. modifierTargets declares generic eligible statistics, not named selectable features. Current entries already hold independent effects; catalog schemas, library-origin fields and a selection workflow still require a dedicated contract before implementation.

## Debugging in Visual Studio Code

Open the RPG-buddy repository folder in VS Code. In Run and Debug, select **Debug contract verifier**, set a breakpoint in a test or verification/validation.py, then press **F5**. The original verify_contracts.py remains the launch entry point; stepping from it enters the split modules. The launch uses the repository's .venv-contracts Python interpreter and integrated terminal. justMyCode keeps stepping focused on this script; frozen modules are disabled for debugger breakpoint reliability. A blank PYTHONPATH prevents inheriting the chat's temporary dependency location.

The environment was prepared during this configuration update. On a fresh checkout, first run **Tasks: Run Task > Contract verifier: set up environment**. It creates the ignored virtual environment with Python on PATH, then installs verification-requirements.txt. **Contract verifier: run** executes the suite normally; breakpoint debugging uses the named F5 launch configuration in .vscode/launch.json. Setup/run tasks live in .vscode/tasks.json. The Python and Python Debugger VS Code extensions are required; both were already installed on this machine.

## Purpose and production boundary

This is specifically a **contract verifier**: it checks authored JSON structures, references, constraints, expression types/dependencies and snapshot integrity. Phase 10 retired the Python arithmetic tracer and calculation API after equivalent TypeScript acceptance passed. Semantic expression validation remains; no Python code evaluates derived results.

Keep new RPG mechanics in reviewed data contracts and the production TypeScript engine. Reuse language-neutral authored inputs and independently stated expectations in TypeScript tests. Python provides an independent check of JSON contracts and fixture integrity, rather than a second rules engine.

## Static type checking and focused discovery

The normal setup/run tasks still need only verification-requirements.txt. Maintainers can install optional type-check tooling separately:

```powershell
.\.venv-contracts\Scripts\python -m pip install -r data_contracts\verification-typecheck-requirements.txt
.\.venv-contracts\Scripts\python -m mypy --strict --no-namespace-packages data_contracts\verification data_contracts\verify_contracts.py
```

To run the focused test files directly through standard discovery:

```powershell
.\.venv-contracts\Scripts\python -m unittest discover -s data_contracts/verification/tests -t data_contracts -v
```

The full command, retained contract-integrity selectors and .vscode tasks/launch files remain available. Arithmetic selectors have been retired as described above. Python caches and the local mypy cache are ignored by Git.
