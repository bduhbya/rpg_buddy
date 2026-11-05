# Phase 13 plan

Branch `phase/2026-11-05-domain-architecture-readability` from `main` at `27d3003ef72507fc6930de6f5c2dcc0312d874b5`. The initial working tree was clean.

The user confirmed the implementation order, requested a domain folder restructuring, and chose to pause after Step 1. The agent records a walkthrough for human review.

## Step 1 — Definitions and instance creation

- [x] Place definition validation, cataloging and resolution in `src/domain/definition-processing/` and creation in `src/domain/instances/`. Place type-only modules and shared definition patterns in `src/domain/definitions/`. Move callers to the owning modules and clarify ownership in the moved code and [architecture guide](../../src/domain/architecture.md). (DR-1, DR-2)
- [x] Trace resolution and creation and record the regression checks. Pause for review. (DR-3)

## Step 2 — Calculation and effects

The user requested the folder move into `src/domain/calculation/` during the Step 1 review. Step 2 clarified the calculation engine and verified phase acceptance against the staged baseline.

- [x] Group the calculation pipeline and its effect processing by responsibility. Clarify stage names and contracts where needed, update callers and complete the [architecture guide](../../src/domain/architecture.md). (DR-1, DR-2)
- [x] Record the calculation-with-effects walkthrough and run the complete validation set. Mark Phase 13 complete in the roadmap when acceptance passes. (DR-3)

## Step 1 checkpoint

Definitions and creation are grouped by responsibility. At the Step 1 review, definition and creation callers moved directly to their owning modules and the root wrappers were removed. Step 1 validation passed and the walkthrough is recorded in [validation.md](validation.md). The user authorized Step 2 after staging the current work as a review baseline.

## Step 2 completion

Clarified the difference between base expression results and the final values consumed by downstream fields. The walkthrough and all required checks passed. Phase 13 is complete.
