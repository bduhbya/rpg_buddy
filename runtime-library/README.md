# Runtime library definitions

This directory is the maintained seed content for a future user-selected library. It is separate from the contract-verification examples in [data_contracts](../data_contracts/README.md). The desktop application does not yet load or install it; filesystem definition loading is Roadmap Phase 15. No local rulebook PDF is required to use these definitions.

## Contents

```text
RPG_systems/rogue-trader/
  system.json
  manifests/1.0.0/system.json
  templates/creature-core/1.0.0/template.json
```

The active manifest and archived 1.0.0 manifest are identical. The archive preserves exact-version resolution when active versions change later. Definition identity comes from IDs and exact versions; canonical directories mirror those identities. Published id/version pairs must remain immutable; future changed definitions require new versions. These files follow the existing [v1 contract](../data_contracts/contracts.md).

## Supported scope

The shared Creature - core statistics template supports both character and monster roles. It contains nine editable integer characteristics (0-99), three derived bonuses and four derived movement values. All characteristic defaults are zero and the default name is Creature: an unfilled sheet, not a generated or legal character. Labels and ordered sections carry semantic presentation information; movement units are metres per round.

Strength, Toughness and Agility Bonuses use floor(score/10). Movement follows the reviewed table, including the explicit zero-Agility-Bonus row Half/Full/Charge/Run = 0.5/1/2/3. The template declares generic strengthBonus and toughnessBonus modifier targets. It contains no named feature catalog, species logic, career selection, role-dependent formulas or built-in Ork effects.

The [approved source review](../specs/2026-10-28_source-review-scope/source-review.md) records the bounded slice and exclusions. Direct citations in the JSON identify the 2009 Rogue Trader core rulebook (RT01, Print ID 01), printed p. 14 and pp. 264-265. The manifest retains the reviewed publication identity and PDF fingerprint; the fingerprint is documentary and does not request a file at runtime. Optional development metadata is omitted from runtime definitions.

## Representative instances and verification

The [Explorator](../data_contracts/examples/explorator.instance.json) and [Ork Freebooter](../data_contracts/examples/ork-freebooter.instance.json) remain verification fixtures, not distributable library instances or template defaults. Both reference this same exact creature template. The Ork owns its explicit Unnatural Toughness x2 snapshot, citing printed pp. 368 and 377. Calculations use that effect, never its name or role. Example identities and timestamps are not instance-creation policies.

Expected example results: Explorator SB4/TB3/AB3; Ork SB5/TB8/AB3. Both have movement3/6/9/18. Editing Ork Toughness to49 retains TB8;50 produces TB10. No complete character legality, combat automation or full bestiary is implied.

The existing in-memory catalog, resolver and calculateWithEntries APIs can validate parsed documents without application integration; see the [domain API guide](../src/domain/README.md#in-memory-definition-catalog-api). Dedicated runtime-data acceptance is in [rogue-trader-runtime-definitions.test.ts](../tests/unit/domain/rogue-trader-runtime-definitions.test.ts). Run `npm run test:unit -- tests/unit/domain/rogue-trader-runtime-definitions.test.ts` from the repository root; the [Phase 11 walkthrough](../specs/2026-11-04_rogue-trader-runtime-definitions/validation.md) explains the expected results. The domain supports [in-memory instance creation](../src/domain/architecture.md#create-an-instance) and [editing with recomputation](../src/domain/architecture.md#edit-an-instance). Desktop integration, filesystem loading, saving, and feature catalogs are planned in later phases.
