# Phase 15 plan

Topic branch `phase/2026-11-07-self-contained-instance-sheets` from `main` at `fed4fbf4e21217caec1224e2282250fb9dabb9ad`. The initial working tree was clean. On 2026-11-07, the user confirmed the two-step order with a pause after the contract, instance schema v2 with an unsupported-version error for source-only v1, and automated checks plus a documented walkthrough.

## Step 1 — Stored-sheet contract

- [x] Record the scope, compatibility policy and validation before implementation (SS-1 through SS-7).
- [x] Add the [instance v2 contract](../../data_contracts/contracts.md), [schema](../../data_contracts/v2/instance.schema.json) and [worked fixtures](../../data_contracts/examples/v2/) for both roles. Each fixture is readable using its stored fields and presentation data (SS-1 through SS-3).
- [x] Verify v2 fixtures with and without definitions. Exercise malformed snapshots and unsupported versions and record the results in [validation](validation.md) (SS-6).

**Review checkpoint.** The user approved the v2 contract and authorized Step 2 on 2026-11-07.

## Step 2 — Domain creation and editing

- [x] Update the [domain model](../../src/domain/definitions/document-models.ts) and [creation flow](../../src/domain/instances/create-instance.ts) to produce complete v2 snapshots (SS-1, SS-4).
- [x] Update [editing](../../src/domain/instances/edit-instance.ts) to commit source and final results as one instance. Validate changed entries even when their effects are unchanged. Demonstrate preservation on equivalent edits, descriptive changes and failures (SS-5).
- [x] Update the [domain guides](../../src/domain/architecture.md) and fixture consumers. Run phase checks and the walkthrough, record [evidence](validation.md), and mark Phase 15 complete on the [roadmap](../roadmap.md) (SS-7).

The v2 contract verifier uses semantic calendar validation to preserve the domain's supported UTC timestamps, including Gregorian year `0000`.

The [v2 bundle](../../data_contracts/v2/) is the supported contract. It contains all three schemas, which advance together, and has matching [v2 examples](../../data_contracts/examples/v2/). The v1 schemas, fixtures, and runtime definitions were retired before release. The [changelog](../../CHANGELOG.md) records the transition.
