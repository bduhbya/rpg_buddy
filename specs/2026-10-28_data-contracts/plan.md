# Phase 2: Data contracts - Plan

## Branch and starting point

- Topic branch: `phase/2026-10-28-data-contracts`, verified before authoring.
- Base: `main`, commit `9b341c9`.
- Initial working tree: clean. Date: 2026-10-28.

## Confirmed decisions

The user accepted the grouped plan, requirements, and validation defaults: JSON Schema 2020-12; exact definition versions distinct from file schema versions; immutable definition paths; restricted expression trees; bounded Phase 1 examples; schema validation, reference inspection, numerical traces, and a human checklist. Runtime implementation remains in later phases.

## Tasks

- [x] P1: Specify document shapes, version resolution and paths (DC-1, DC-2). Complete when contracts and schemas agree.
- [x] P2: Specify expressions, semantic validation and diagnostics (DC-3, DC-4). Complete when every operation and failure boundary is explicit.
- [x] P3: Add manifest, one shared creature template and two instance examples (DC-5). Complete when exact references and Phase 1 coverage are inspectable.
- [x] P4: Validate schemas/examples and trace positive/negative cases (DC-6). Complete when reproducible checks pass and evidence is recorded.
- [x] P5: Inspect consistency and update roadmap (DC-6). Complete when all acceptance criteria pass.

## Boundaries

No Electron foundation, runtime validator, production evaluator, persistence implementation, full rules transcription, or editor. The verification script is a contract harness, not application code. Shared rules remain unsupported in schema version 1 because this slice has no concrete shared-definition requirement; a future version must specify their document and resolution contract before use.

## Completion

Original and revised DC-1 through DC-8 acceptance criteria passed. The user-authorized flexible creature model revision below is complete, including the explicit constitution changes. Application implementation remains deferred. Verification results and future runtime limits are recorded in validation.md. Verification-only jsonschema dependency installed outside the repository for this run; reproduction uses an isolated virtual environment.

## Artifact organization update

The user requested that phase folders contain only plan.md, requirements.md, and validation.md. Phase 2 deliverables now live in the maintained repository-level `data_contracts/` folder: `contracts.md`, `v1/` schemas, `examples/`, README, dependency list and verification harness. These artifacts can evolve across phases. References and verification commands were updated; the phase branch and approved behavior are unchanged.

Maintained artifacts: [contract reference](../../data_contracts/contracts.md), [schemas](../../data_contracts/v1/), [examples](../../data_contracts/examples/), and [verification instructions](../../data_contracts/README.md).

Template naming clarification: retained descriptive stable IDs and fixed `template.json` filenames; moved example templates into ID/version directories and updated the verification harness. No rule or version changes.

## Authorized flexible creature model revision

The user approved shared character/monster sheet structure, instance-level roles and free-form selections, and explicit generic feature effects (including Unnatural Toughness and Unnatural Strength). This revises the Phase 1 representation decision, not its numeric examples. Continue on the recorded Phase 2 branch; no new phase documents are being created.

- [x] R1: Revise constitution and requirements to separate entity type, instance role and library placement; specify free-form career and selected entries without rulebook legality enforcement (DC-7).
- [x] R2: Define bounded, instance-owned multiplicative effects on template-declared derived targets, including conflict rules and post-base evaluation semantics (DC-8).
- [x] R3: Consolidate fixtures to one creature template and move the Ork multiplier into its trait entry; update schemas and harness (DC-7, DC-8).
- [x] R4: Validate inherited examples, feature addition/removal, character-role reuse, description-only/custom entries, modifier errors and independence; record results (DC-6 through DC-8).

The revised contract is the first unpublished v1 draft: the repository has no application, published definitions or saved user library. Amend the draft in place; do not invent a migration or imply old files silently load. Published versions remain immutable. Space Marine rule/profile transcription is not included; test generic Strength/Toughness effects using constructed examples rather than asserting a full Space Marine profile.

Revision completion: shared template and instance-owned features verified against 17 inherited numeric vectors, 14 feature checks and 63 negative cases. Current evidence and deferred runtime checks are recorded in validation.md.

Base-template naming correction: changed defaultDisplayName from Example Creature to Creature; sample instance names and numeric data are unchanged.

## Zero defaults and verification readability update

User requested zero for every base attribute and a human-readable Python verifier.
- [x] Z1: Set all nine template input defaults to zero; keep worked instance values separate.
- [x] Z2: Replace dense global/lambda-based checks with named verification methods, descriptive test cases, explicit expected statistics and readable output; retain existing positive/negative coverage.
- [x] Z3: Run all checks, including a fresh zero-default creature and inherited rule examples, and update evidence and reproduction guidance.

Zero-default/readability completion: all 20 named unittest groups pass, retaining 17 worked numeric vectors, 14 feature checks and 63 rejection cases, plus the new all-zero initialization calculation. No additional verification dependency was added.

## Optional development provenance revision - 2026-10-29

User requested rulebook citations remain in source fields and phase/requirement references move to optional metadata. Update entry source and template sourceReview/sourceRefs consistently, keeping direct rulebook references independent of development documents. Validate with/without metadata, reject malformed metadata, and verify calculations remain unchanged.

Optional provenance revision complete: sources cite the rulebook directly; all phase/requirement provenance is optional metadata. All 22 named test groups passed, including metadata-free calculations and malformed-metadata rejection.

Feature-library clarification - 2026-10-29: inspected the template and entry schemas; no structural change is needed for generic modifier targets and self-contained effects. Recorded the separate catalog, instance snapshot, exact provenance and explicit-upgrade commitments in the constitution, contract reference and roadmap. Future catalog/origin schemas and selection implementation remain explicit follow-on scope.

VS Code debugging update - 2026-10-29: user requested verifier debugging support. Add workspace setup/run tasks and a Python debug launch using an isolated ignored .venv-contracts environment; validate interpreter/dependencies, normal verifier execution and debugger startup. No contract semantics change.

VS Code debugging setup complete: isolated interpreter/dependencies prepared, all 22 verifier groups pass, and a bundled-debugger smoke check passes. Usage and UI verification limits are recorded in README.md and validation.md.

## Typed verifier modules - 2026-10-29

User authorized a multi-file typed refactor preserving the existing CLI, focused-test selectors and VS Code debug configuration.
- [x] T1: Extract typed document shapes, JSON/numeric helpers, semantic validation and bounded expression tracing into verification/ modules.
- [x] T2: Split the existing 22 tests into focused contract/calculation/feature modules with shared fixture helpers; retain the ContractTests selector and script entry point.
- [x] T3: Document the contract-verification boundary and future TypeScript conformance handoff; preserve explicit independent expected results.
- [x] T4: Run full/focused suites, static type checking, task/launch paths and debugger smoke checks; record results.

No schema, rule content, library behavior or production engine changes are in scope.

Typed refactor complete: 22 original scenarios pass via the compatibility entry point and focused discovery; original test bodies/expected values are unchanged apart from type annotations/casts. Strict mypy passes all 12 Python files; focused selector, quiet imports and bundled-debugger smoke check pass. Existing task/launch files are unchanged.
