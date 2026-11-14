# Character sheet display presentation replan requirements

## Baseline

The [roadmap](../roadmap.md) at the starting commit completes Phases 1–19, then schedules creation, editing, combined save/load, and milestone verification. Phase 17 provides saved-instance loading and Phase 19 provides safe saving in the main process.

## Agreed revision

- **R1.** Schedule Phase 20 creation, Phase 21 loading, Phase 22 shared sheet presentation, Phase 23 editing, Phase 24 saving, and Phase 25 milestone verification, in that order.
- **R2.** Phase 21 uses prepared saved sheets to verify loading before save controls exist. Open both roles using their stored statistics, and explain read-only mode when exact definitions are unavailable.
- **R3.** Phase 22 uses a shared display for characters and monsters, for both newly created and reopened sheets. It establishes the display that Phase 23 extends with editing. Use the Rogue Trader manual's character sheet as the visual specification for supported milestone data.
- **R4.** Phase 24 adds save controls after editing and verifies the edit, save, and reopen flow for both roles. Phase 25 verifies the full first milestone.
- **R5.** Preserve completed-phase history and the [first milestone](../mission.md#first-functional-milestone). Keep the roadmap, technology plan, and living architecture guide in agreement. Assign implementation and workflow verification to the individual phases.

## Presentation ownership

- **R6.** Use the existing validated snapshot for created, reopened, and read-only sheets. The snapshot supplies sheet information and stored results. The Rogue Trader component owns grouping, ordering, and placement. Preserve the sheet data contract for Phase 22.
- **R7.** Revisit a separate configurable presentation specification when planning a second system after the first milestone. Aim to reuse the sheet data contract when introducing configuration.
