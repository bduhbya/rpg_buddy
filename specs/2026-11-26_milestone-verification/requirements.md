# Phase 25 requirements

## Context

The [mission](../mission.md#first-functional-milestone), [roadmap](../roadmap.md), and [technology plan](../tech-stack.md) define the first milestone. The [Phase 24 suite](../../tests/smoke/sheet-saving.spec.ts) already saves and reopens both roles in a single process.

## Scope

Verify the existing Rogue Trader creature sheet workflows using a disposable library. Address blocking milestone defects if found. Expanded rule coverage, feature-library authoring, and later milestones are outside this phase.

## Product decisions

The existing shared character and monster sheet, reviewed rulebook traits, versioned local library, and stored-result behavior define acceptance. The user confirmed that verification includes a restart and a human walkthrough of both roles.

## Technical requirements

- **MV-1.** Load the supported creature template and create distinct character and monster sheets. Edit core values and reviewed effects and verify the calculated results.
- **MV-2.** Save each role to its library destination. Reopen both after restarting the app and verify identity, source values, effects, and stored final statistics. Loading must preserve stored results and leave file bytes intact.
- **MV-3.** Verify actionable feedback and preservation of valid data for invalid inputs, unsupported definitions, calculation failure, and failed saves. Verify that a missing exact dependency allows read-only viewing with stored results and prevents editing and saving. Reuse existing workflow diagnostic events and verify representative success and failure records through the existing tests. Verification itself introduces no application workflow events.

- **MV-5.** Changing the display name in Create a sheet clears its previous result and success message. View sheet is disabled until the form successfully creates a sheet again.

## Accessibility requirements

Verify keyboard activation of the core workflow, focus on the sheet or failed input where applicable, and labeled controls and understandable feedback for both roles.

## Completion requirements

- **MV-4.** Pass the automated Windows validation checks and record failure-path evidence. Record the user's successful walkthrough for both roles and any explicitly accepted limitations before closing the phase.
