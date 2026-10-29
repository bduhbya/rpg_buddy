# Phase 2 contract fixtures

This folder specifies the data layer and provides demonstration JSON. Normative contracts are in contracts.md; structural schemas are in v1/. The examples are not installed runtime content and the Python harness is not a production engine.

From the repository root, with Python 3.12 or later:

```powershell
python -m venv .venv-contracts
.\.venv-contracts\Scripts\python -m pip install -r data_contracts\verification-requirements.txt
.\.venv-contracts\Scripts\python data_contracts\verify_contracts.py
```

Keep the local virtual environment out of Git. No application build or Electron installation is needed. This verification-only dependency does not choose the future TypeScript runtime validator.

Both character and monster instances reference the same `creature-core` template. The Ork owns its Unnatural Toughness trait entry and explicit multiplier. User-chosen careers and custom entries are descriptive unless an explicit supported effect is supplied.

The harness checks all schemas/examples, exact reference relationships, field and section integrity, types/dependencies/cycles, input constraints and worked arithmetic. It deliberately does not implement production diagnostics, filesystem resolution, transaction safety or UI preservation. Review those future obligations in contracts.md and ../specs/2026-10-28_data-contracts/validation.md.

Template examples use `examples/templates/<template-id>/<template-version>/template.json`: the directory ID is descriptive and the definition filename is always `template.json`. The JSON `label` supplies the readable display name.

The revised v1 draft replaces the original unpublished two-template draft. All nine template attribute defaults are 0; the Explorator and Ork instances retain their own distinct worked values. Feature effects are instance-owned, role-independent, and limited to one multiply effect per declared target.

## Reading the verifier

The script uses Python's standard unittest runner. Normal execution prints the purpose of each named test group, followed by OK or a failure report. Invalid-case tables use named subtests so a failure identifies the exact scenario, such as an invalid calendar date or conflicting effects. Unexpected programming errors do not count as successful invalid-data rejection.

The script is now a small entry point for these typed modules:

```text
verification/
  models.py              TypedDict document shapes and Literal operations
  helpers.py             Strict JSON loading and numeric checks
  validation.py          Schema and cross-document verification
  expressions.py         Bounded arithmetic/dependency traces for fixtures
  runner.py              Compatibility suite and unittest command handling
  tests/
    support.py           Fixture loading, builders and named expected results
    test_contracts.py    Structure, identity, provenance and invalid documents
    test_calculations.py Worked numbers, boundaries and expression failures
    test_features.py     Instance-owned effects and custom selections
verify_contracts.py      Existing CLI and VS Code entry point
```

Read ContractVerifier in validation.py for document checks, expected_statistics in tests/support.py for the seven named results, and the focused test modules for acceptance scenarios. runner.ContractTests combines the test classes exactly once, preserving selectors such as ContractTests.test_zero_defaults. Test methods start with test_. Fixture copies keep cases independent. Importing the entry point or modules does not run tests. The entry point resolves imports through its script directory, so it also works when invoked by absolute path from another working directory.

Type hints describe validated shapes; JSON Schema and semantic checks still perform runtime validation. RawDocument is intentionally permissive only at JSON/schema boundaries and in tests constructing malformed documents. Domain expressions and validated document access use TypedDict, Literal and explicit parameter/return types.

The zero-default test constructs an unfilled creature with all nine inputs at 0 and expects bonuses 0 and movement (0.5, 1, 2, 3). The Explorator and Ork instance fixtures retain their original nonzero worked values. Calculation comparisons use dictionaries keyed by statistic name, and schema/semantic errors include readable context. This remains a verification harness, not production application behavior.

To run just the default-initialization check:

```powershell
.\.venv-contracts\Scripts\python data_contracts\verify_contracts.py ContractTests.test_zero_defaults
```

The full suite currently has 22 named test groups. Individual tables contain multiple named subcases; the summary's test count describes groups, not the number of numeric vectors or rejected documents.

Rulebook citations in source/sourceRefs are self-contained. Optional metadata holds development-only sourceReview, requirementRefs and sourceRegisterRefs; the loader and calculations do not require those development documents. The provenance checks exercise both metadata-free and annotated data.

The feature-library/snapshot design is recorded in contracts.md. modifierTargets declares generic eligible statistics, not named selectable features. Current entries already hold independent effects; catalog schemas, library-origin fields and a selection workflow still require a dedicated contract before implementation.

## Debugging in Visual Studio Code

Open the RPG-buddy repository folder in VS Code. In Run and Debug, select **Debug contract verifier**, set a breakpoint in a test or verification/validation.py, then press **F5**. The original verify_contracts.py remains the launch entry point; stepping from it enters the split modules. The launch uses the repository's .venv-contracts Python interpreter and integrated terminal. justMyCode keeps stepping focused on this script; frozen modules are disabled for debugger breakpoint reliability. A blank PYTHONPATH prevents inheriting the chat's temporary dependency location.

The environment was prepared during this configuration update. On a fresh checkout, first run **Tasks: Run Task > Contract verifier: set up environment**. It creates the ignored virtual environment with Python on PATH, then installs verification-requirements.txt. **Contract verifier: run** executes the suite normally; breakpoint debugging uses the named F5 launch configuration in .vscode/launch.json. Setup/run tasks live in .vscode/tasks.json. The Python and Python Debugger VS Code extensions are required; both were already installed on this machine.

## Purpose and production boundary

This is specifically a **contract verifier**: it checks authored JSON structures, references, constraints and the independent expected numbers in the acceptance fixtures. The Python expression tracer is a bounded aid for checking those documents before the application exists. It is not an application service, a second production rules engine, or the authority for interpreting the rulebook.

Keep new RPG mechanics in reviewed data contracts and the production TypeScript engine. When that engine becomes available, exercise it with the same explicit input/output and invalid-data acceptance cases. Export/reuse language-neutral fixture cases as needed, retaining independently stated expectations. Replace or retire overlapping Python arithmetic tracing rather than extending two general-purpose evaluators in parallel. Continue using Python where it adds independent value for JSON contracts and fixture integrity; never derive TypeScript test expectations from the Python evaluator's output.

No new operators, rules, effects or production functionality were added by the module/type-hint refactor.

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

The existing full command, focused ContractTests selectors and .vscode tasks/launch files are unchanged. Python caches and the local mypy cache are ignored by Git.
