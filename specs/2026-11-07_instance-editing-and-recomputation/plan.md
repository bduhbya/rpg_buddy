# Phase 14 plan

Topic branch `phase/2026-11-07-instance-editing-and-recomputation` from `main` at `424cd2d63450792fe104b7497edb2b81cb687929`. The initial working tree was clean. On 2026-11-07, the user confirmed the scope, two-step order with a review pause, and validation with a reproducible walkthrough.

## Step 1 — Source edits and atomic recomputation

- [x] Confirm scope, requirements and validation on a dedicated branch.
- [x] Add the in-memory source-edit operation. Resolve the instance's exact definitions, apply a candidate patch, recompute with existing entries, and return independent source state and derived results together (IR-1, IR-3 through IR-6).
- [x] Validate the source-edit operation and record its evidence. Update the [domain guide](../../src/domain/architecture.md) with the edit flow.

**Review checkpoint.** Step 1 was reviewed. The user authorized Step 2 after requesting explicit entry and effect lookups in the fixture tests.

## Step 2 — Instance-owned entry edits and acceptance

- [x] Extend the operation with add, update and remove by entry ID. Reuse the candidate validation and recomputation path (IR-2 through IR-6).
- [x] Add runtime acceptance and a walkthrough using two independently owned Rogue Trader instances. Run the phase checks, update the domain guide and record completion before marking Phase 14 complete on the [roadmap](../roadmap.md) (IR-7).

## Follow-up — One operation per call

- [x] Replace object patches with one operation per call. Use primitive arguments and parse entry snapshots from JSON text (IR-1 through IR-5).
- [x] Remove the runtime object classifier and realm registration. Update callers, documentation, and the acceptance walkthrough to use the new boundary (IR-4, IR-7).
