# Character sheet display presentation replan

- Branch `replanning/2026-11-14-character-sheet-display-presentation`
- Starting commit `f1a37af01f8ddab6e944c1d7c6eb8d4ef29507d8` on `main`

Split loading and saving into independently verifiable interface phases. Schedule shared sheet presentation after loading so the layout can be verified with created and reopened sheets before editing adds controls.

1. [x] Establish the repository baseline and check out the replanning branch.
2. [x] Record the agreed scope and phase order in [requirements](requirements.md).
3. [x] Revise Phases 20–25 in the [roadmap](../roadmap.md) and align the [technology plan](../tech-stack.md#system-definitions-and-templates) and [living architecture guide](../../src/domain/architecture.md).
4. [x] Verify document consistency and record the phase handoff in [validation](validation.md).
5. [x] Record the manual as the visual specification, assign layout ownership to the Rogue Trader component, and defer configurable presentation.
