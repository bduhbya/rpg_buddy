# Phase 24 requirements

## 1. Context

[Phase 19](../2026-11-13_safe-instance-saving/requirements.md) safely writes complete snapshots. [Phase 23](../2026-11-24_sheet-editing-interface/requirements.md) owns the editable revision and pending drafts. [Phase 24](../roadmap.md) connects them under the [persistence constitution](../tech-stack.md#persistence-and-verification).

## 2. Scope

List a library destination and save created or opened editable sheets. Support first writes and safe replacement. System-defined destinations, additional NPC destinations, imports, and changes to the stored format are deferred.

## 3. Product decisions

Preselect and show one destination for the sheet's role, labeled with the system and Characters or Monsters. Use the selected library and canonical stable-ID filename. Show Save with the edit actions and the destination below them. Newly created sheets open in edit mode on their first visit. Saved sheets and later visits open in view mode. Enable Save on a new sheet or when edits change the saved content. Strip leading zeros from numeric inputs and treat equivalent values and edits that restore the saved content as clean. A successful Save stays in edit mode and refreshes the saved-sheet list. Done prompts to save, discard, or keep editing if there are unsaved edits. Read-only sheets have no save controls.

## 4. Technical requirements

- **SA-1.** Main resolves destination IDs and labels from the active sheet and library context. Keep discovery behind a main-process function and leave a TODO for system-definition-driven destinations. IPC accepts the editable handle and a destination ID for writes. Validate the trusted top-level sender and reject malformed, stale, or unsupported requests.
- **SA-2.** Save the main-owned snapshot through the existing safe saver. Keep one save in flight per target. Verify under the persistence lock that the primary still matches the last saved or opened snapshot. A snapshot matching the primary apart from its modification timestamp must leave the primary and backup intact. Preserve actionable diagnostics and reuse `instance.save`. The saver owns persistence checkpoints and terminal outcomes. Bridge rejections log stable reasons without paths, IDs, or sheet contents.
- **SA-3.** Submit pending edits before saving. If a draft is rejected, prevent the save and preserve correction behavior. If the write fails, retain accepted edits for retry.

## 5. Accessibility requirements

- **SA-4.** Give the destination and Save controls programmatic names and keyboard access. Announce progress and outcomes in text. Use existing rejection focus for invalid drafts.

## 6. Completion requirements

- **SA-5.** Edit, save, and reopen a character and a monster. Verify identity, source values, entries, effects, and stored results. Verify actionable failure and retry, unchanged persistence on rejected drafts, and read-only behavior.
