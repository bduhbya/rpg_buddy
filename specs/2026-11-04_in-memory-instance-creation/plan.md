# Phase 12: In-memory instance creation

Branch: `phase/2026-11-04-in-memory-instance-creation`.
Starting base: `main` at `2eb1201dbbd230c2744ef89091da046f17b63b16`. The working tree was clean and branch checkout was verified before writing specifications.

The user confirmed scope, validation and two steps with a pause after Step 1 on 2026-11-04. Separate human walkthrough execution is not a completion gate.

## Step 1: Domain creation API

- [x] Add createInstance using the existing catalog/resolver, closed request validation and injected ID/time providers (IC-1 through IC-4). Complete when defaults and independent source-only instances are returned, with located failures and no partial value.
- [x] Add focused tests for both roles, exact references, defaults, identity/data independence, provider failures and recovery (IC-1 through IC-5). Run focused/full unit tests, TypeScript, contract integrity, formatting and whitespace checks; record evidence.
- [x] Hand back the focused API diff for human review. Stop before Step 2.

## Step 2: Runtime acceptance and completion

- [x] After review, add creation acceptance using maintained runtime definitions and independent default/calculation expectations (IC-5).
- [x] Update the living domain architecture with creation flow and provider ownership; document a reproducible walkthrough (IC-6).
- [x] Run all required checks, record completion evidence and update the roadmap only after acceptance passes (IC-6).

No UI, persistence, edit API, feature catalog or saved-instance validator is included. ID uniqueness across creations is the provider's responsibility; the stateless domain validates the supplied identifier but retains no global identity registry. Application provider wiring is deferred to the application integration phase.

## Step 1 checkpoint

Review refinement on 2026-11-05. The shared `INSTANCE_ROLES` tuple drives the TypeScript role type, creation validation and its diagnostic. The v1 schema still defines the same two roles. System-specific roles would require a versioned contract decision covering definition declarations and the mapping to library workflows.

Completed on 2026-11-04. createInstance validates the closed request, resolves its exact definitions, obtains and validates provider output, then constructs independent source-only state. All 37 focused tests and 311 full unit tests passed, along with TypeScript, 10 Python integrity groups, formatting and whitespace checks. Step 2 has not started. Awaiting the requested human review; the phase and roadmap remain incomplete.

## Step 2 completion

The user authorized Step 2 on 2026-11-05. Runtime acceptance now creates both roles through the production API, checks independent defaults and state, and verifies calculated results. The architecture and walkthrough document the flow and ID provider responsibility. The required checks passed and the roadmap marks Phase 12 complete. See [validation evidence](validation.md).
