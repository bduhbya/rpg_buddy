# Phase 11 requirements

## 1. Context

Phase 10 completed instance-entry effects. Roadmap Phase 11 promotes approved Rogue Trader examples into maintained runtime definitions. Authoritative sources are [mission](../mission.md), [architecture](../tech-stack.md), [roadmap](../roadmap.md), [approved source review](../2026-10-28_source-review-scope/source-review.md), and [v1 contracts](../../data_contracts/contracts.md). The source review establishes the 2009 core rulebook, RT01, Print ID 01 and its local PDF fingerprint. This phase uses that approved review and introduces no newly interpreted rules.

## 2. Scope

RD-1: Maintain active and exact archived system manifests plus creature-core 1.0.0 in [runtime-library](../../runtime-library/README.md), following canonical contract paths. Keep contract examples available for independent contract verification.

Include nine editable characteristics, seven derived values, semantic sections, citations and generic Strength/Toughness Bonus modifier targets. Representative character and monster snapshots remain test inputs under data_contracts/examples, outside the runtime library.

Exclude UI, application integration, filesystem loaders, library selection, saving, instance creation/editing APIs, migrations, new rules, full character legality, complete bestiary content and feature catalogs. Phase 12 consumes the template for creation; Phase 14 introduces loading. Existing engine APIs provide verification now.

## 3. Product decisions

RD-2: One shared creature template serves both roles. All nine defaults remain zero with defaultDisplayName Creature; these represent an unfilled sheet, not legal generated statistics. Inputs remain integers 0 through 99. Preserve the seven agreed derived formulas, including the explicit zero-Agility-Bonus movement row 0.5/1/2/3 metres per round.

RD-3: Only strengthBonus and toughnessBonus are modifier targets. No named features, role/species branches or Ork multiplier enter the template. Existing instance-owned Ork effects produce TB8 at T45/T49 and TB10 at T50. Explorator remains SB4/TB3/AB3 with movement3/6/9/18. Feature catalogs and origins remain separately deferred. No distributable sample instances are added.

## 4. Technical requirements

RD-4: Runtime JSON must pass the existing structural validators, exact catalog/resolver and calculation APIs. Active and archived manifest content must be identical. IDs, versions and directories agree; preserve existing v1.0.0 mechanics and direct rulebook citations. Omit optional development metadata from runtime definitions so development phase references are not distributed as runtime dependencies. Rulebook fingerprints are identity metadata, not files to load. No production code changes or new API are required.

Dedicated acceptance tests must read the actual runtime files, resolve exact references and assert independently stated results using representative fixture snapshots and edited/boundary values. Verify unsupported targets/conflicting effects are rejected and failed calculations preserve caller inputs. Do not imply whole-instance validation or production filesystem loading exists.

## 5. Accessibility requirements

RD-5: No interface changes occur. Preserve human-readable labels, semantic section and field ordering, derived/input distinctions and movement units for later accessible interfaces. Runtime documentation must explain the bounded slice and zero defaults without relying on color or images. Keyboard/focus/screen-reader interaction testing belongs to later interface phases.

## 6. Completion requirements

RD-6: Complete when canonical runtime data and documentation satisfy RD-1 through RD-5; focused runtime acceptance, all unit tests, TypeScript, Python contract integrity, formatting and whitespace checks pass; and validation.md records actual evidence plus a reproducible walkthrough. Step 1 must pause for human review before new Step 2 acceptance work. Separate human execution is not required. Desktop packaging/smoke checks are outside this phase because no application integration changes.
