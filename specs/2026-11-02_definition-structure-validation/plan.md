# Phase 7: Definition structure validation - Plan

## Starting point and decisions

Topic branch: `phase/2026-11-02-definition-structure-validation`, created and verified before writing these documents. Starting base: `main` at `151a6b4099135383356795c00b7fcae3832d29ee`; working tree initially clean. On 2026-11-02 the user accepted scope and validation and chose pauses after each step.

Use small handwritten validators for the bounded v1 contracts, without new dependencies or a second generic schema engine. The JSON schemas and normative contract remain authoritative. Runtime imports within the domain are now necessary; adapt the foundation boundary test to enforce domain confinement while permitting runtime declarations/imports. No logging is needed for pure validation.

## Step 1: API, shared checks and manifests

- [x] P1 (DS-1, DS-2): Add a discriminated validation result and shared object, string, reference and diagnostic helpers. Complete when unknown parsed values can be checked without mutation or partial success.
- [x] P2 (DS-1, DS-2): Validate every manifest property, exact version format, fingerprint and unique template pairs; add positive/negative tests and update boundary checks.
- [x] P3 (DS-3): Run step checks and record evidence, then stop for human review.

Review checkpoint: wait for feedback or authorization before step 2.

## Step 2: Templates and phase completion

- [x] P4 (DS-1, DS-2): Reuse shared checks for template fields, metadata and recursive expression shapes. Enforce safe numbers, bounds/defaults, unique fields/sections, exact section membership and valid modifier target declarations. Defer expression reference/type/cycle analysis.
- [x] P5 (DS-3): Add fixture and malformed nested cases, verify diagnostics and preservation, document the public API and supplementary walkthrough, run all agreed checks and update the roadmap only when complete.

Step 2 depends on reviewed step 1. Keep fixtures, schemas, Python verifier and application wiring unchanged. If recursive validation or local invariants grow beyond a focused review, split step 2 before implementation.

## Progress

Specifications recorded before implementation. User reviewed step 1, requested named regex constants and mirrored test directories (implemented and revalidated), then authorized step 2. Step 2 completed on 2026-11-02. Phase complete; see validation.md.
