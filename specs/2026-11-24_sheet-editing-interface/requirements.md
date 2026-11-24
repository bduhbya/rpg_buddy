# Phase 23 requirements

## Context

The [roadmap](../roadmap.md) extends the Phase 22 Rogue Trader presentation with Phase 14 domain edits and Phase 15 self-contained snapshots. Phase 24 adds saving.

## Scope

Edit the name, optional career, template source values, and instance-owned entries on newly created and editable reopened sheets. Leave file saving, feature-library selection, and derived-statistic overrides to their owning phases or follow-up work.

## Product decisions

- **SE-1.** Use the same sheet component, section order, and field positions in view and edit modes, with an Edit button to enter and Done to leave. Users can apply each field or entry independently or use Done to submit all remaining drafts. Keep drafts local while typing and refresh the sheet after successful edits. If Done encounters a rejected edit, keep edit mode open, retain unapplied drafts, and identify the rejected change. An accepted edit remains applied. Keep read-only sheets viewable without editing controls.
- **SE-6.** Phase 24 Save will use the same pending-edit submission flow before writing the sheet. If any draft is rejected, keep edit mode open and leave the saved file untouched. Done in Phase 23 updates the in-memory sheet.

## Technical requirements

- **SE-2.** Keep the authoritative sheet and exact definitions in main. Issue an opaque edit handle for the latest successful creation and the latest editable opening in the current selection. Verify trusted frame, exact payload shape, handle and edit revision before dispatch. Replace the authoritative snapshot and advance its revision atomically on acceptance. Reject obsolete revisions without changing the sheet. Read-only openings issue no handle and replace the previous opening.
- **SE-3.** Use the existing domain edit API for validation and applicable recalculation. Return actionable located diagnostics and keep the last valid sheet on failure. Log `instance.edit` with stable steps and outcomes through the existing logger. Keep sheet contents, paths, and handles out of logs.

## Accessibility requirements

- **SE-4.** Provide descriptive input and Apply labels, visible keyboard focus, and accessible success and error feedback. Keep keyboard focus predictable when switching modes or applying a change. Preserve narrow-width reflow.

## Completion requirements

- **SE-5.** Pass V1 and V2 and provide V3 for the user to repeat. Exercise both roles, source and entry edits, rejected operations, recalculation, and read-only behavior.

## Edit bar revision

- **SE-7.** Replace individual Apply actions with one sticky edit bar containing Done, Apply edits, and Discard edits. Apply edits submits pending changes and stays in edit mode. Done submits pending changes and returns to viewing after success. Discard edits clears pending changes and stays in edit mode. Previously accepted edits remain applied. Stage entry removal with the other drafts. Keep all three controls in view when scrolling, including at narrow widths. Preserve the existing rejection and read-only behavior.

## Rulebook entry revision

- **SE-8.** Offer the two reviewed Rogue Trader selections, Unnatural Strength (x2) and Unnatural Toughness (x2), when the active template supports their effect targets. The main process accepts a known selection ID and supplies the fixed entry snapshot and source citation. Existing entries retain their recorded details and can be removed. Defer custom trait and effect authoring to a separate feature library workflow.

- **SE-9.** Provide a rulebook entry dropdown with category and case-insensitive name search filters. Read the category choices from the temporary catalog. Offer Traits and Talents, including an empty result when a category has no matches. Allow users to stage multiple entries and undo individual additions before applying edits.
- **SE-10.** Search from within the dropdown control. Support opening and navigating with arrow keys, choosing a highlighted result with Enter, and closing with Escape. Selecting a result must leave staging to the separate Stage entry button.
