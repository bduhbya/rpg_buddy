# Phase 9 Base calculation engine

Branch `phase/2026-11-03-base-calculation-engine` from `main` at `74f693eeaf1bc7db2aa0ea66548d96a26a710b4d`. The initial working tree was clean.

## Step 1 Dependency ordering

- [x] Build a calculation order from the resolved template. Verify every expression branch, missing references, and cycles (BC-1).
- [x] Run the graph checks and record evidence. Pause for human review.

## Step 2 Base evaluation

- [x] After review, check operand types and supplied inputs, then evaluate expressions in dependency order (BC-2).
- [x] Verify both worked examples and failure paths, record results, and update the roadmap when all acceptance criteria pass (BC-3).

## Completion

The user authorized step 2 on 2026-11-04. Both implementation steps and required automated validation are complete. The separate human walkthrough is available for review.

The base API accepts a located template and a located input map, revalidates mutable templates, returns only derived results, and owns no persistent state. This keeps instance validation and effects available for later phases without expanding this phase.

## Python verification transition

Retirement of the Python arithmetic tracer is carried into Phase 10. Its feature tests still require evaluation with instance effects, which this phase deliberately excludes. No Python evaluator behavior was extended. The TypeScript tests now own base-engine acceptance, using independent expected numbers. Phase 10 must port effect acceptance and retire overlapping tracing once that coverage is available.
