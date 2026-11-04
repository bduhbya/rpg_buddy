# Phase 10 Instance-entry effects

Branch `phase/2026-11-04-instance-entry-effects` from `main` at `45077b7c65b9f2001079d20fdd91b5523b80ed54`. The initial working tree was clean. Branch checkout was verified before creating these specifications.

The user confirmed scope, validation and two steps with a human review pause on 2026-11-04.

## Step 1 Entry validation and effect-aware calculation

- [x] Validate v1 entries and effects with located errors, unique IDs, declared targets and conflict rejection (IE-1, IE-4). Complete when focused positive and negative tests pass.
- [x] Integrate multiplication between base evaluation and downstream references without changing calculateBase semantics (IE-2, IE-3). Complete when focused tests demonstrate propagation, safe arithmetic, no mutation and recovery.
- [x] Update the domain architecture and record unit/type/format verification evidence. Pause for human review before Step 2.

## Step 2 Acceptance migration and phase completion

- [x] After review, port all remaining Python effect/arithmetic acceptance cases into TypeScript, maintaining independent expected values (IE-5).
- [x] Retire overlapping Python arithmetic tracing and affected tests/helpers; retain structural/semantic contract integrity checks and update their documentation (IE-6).
- [x] Run the full agreed validation, document the human walkthrough, and update README/roadmap only when completion requirements pass.

The first step is one coherent runtime behavior; the second contains the dependent verifier migration. No verifier retirement or roadmap completion occurs at the first checkpoint.

## Step 1 checkpoint history

Completed on 2026-11-04 and handed back for human review; approval is recorded under Step 2 completion. The original evaluator moved into [calculation-engine.ts](../../src/domain/calculation-engine.ts), shared by the unchanged-signature base API and the new [calculateWithEntries API](../../src/domain/calculate-with-entries.ts). [validate-entry-effects.ts](../../src/domain/validate-entry-effects.ts) owns the entry boundary. The [architecture guide](../../src/domain/architecture.md) describes the flow. No Python verifier changes or phase completion claims are included in this step.

## Step 2 completion

The user approved Step 1 and authorized Step 2 on 2026-11-04. The remaining acceptance cases passed before Python arithmetic removal. TypeScript tests reuse the authored JSON inputs and independent expected numbers; coverage remains organized by engine, operation, entry validation and public API integration.

Removed trace_statistics, ContractVerifier.calculate, the unused modifier-collection API, arithmetic-only Python tests/helpers and result-only type aliases. Python retains expression type/reference/cycle validation plus schema, identity, values, timestamps, entry and target/conflict integrity. The Python CLI, VS Code launch and discovery continue to work; retired arithmetic selectors and updated focused selectors are documented in [the verifier guide](../../data_contracts/README.md).

Both steps are complete. All required automated checks passed and the reproducible human walkthrough is documented in [validation.md](validation.md). Separate human execution was not required or claimed. No changes to the v1 operation set, runtime definitions, UI, persistence or full-instance domain validation were introduced. Roadmap Phase 11 runtime definitions is next.
