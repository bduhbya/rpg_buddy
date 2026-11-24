# Phase 23 validation

## V1 Edit bridge (SE-2, SE-3)

Status: Passed on 2026-11-24

Run `npm run typecheck`, `npm run test:unit`, formatting, and `git diff --check`. Exercise the trusted handler and main-owned edits with valid snapshots and exact definitions. Expect bad origins, malformed input, unknown handles, and obsolete revisions to be rejected. Verify invalid edits preserve the snapshot and revision, corrected edits recompute, and success and failure produce privacy-preserving logs. Check that read-only opens receive no capability.

- `npm run typecheck`, `npm run format:check`, and `git diff --check` passed. All 497 unit tests passed. [Creation coverage](../../tests/unit/main/sheet-creation.test.ts) verifies foreign-frame and malformed request rejection, recovery from an invalid Strength edit, recalculation, stale revisions and handles, and privacy-preserving diagnostics. [Opening coverage](../../tests/unit/main/sheet-loading.test.ts) verifies both roles, exact-definition editing, read-only capability invalidation, and unchanged files.
- `npm run package` and `npm run test:smoke:package` passed in an isolated copy with 36 passing tests. The in-place Forge build encountered a Windows rename error while a development instance was running. The packaged [creation smoke test](../../tests/smoke/sheet-creation.spec.ts) called the live preload bridge and observed Agility 42, Half Move 4, Run 24, and revision 1.

## V2 Packaged application (SE-1, SE-4, SE-5)

Status: Passed on 2026-11-24

Build with `npm run package` and run `npm run test:smoke:package`. Exercise a created and saved sheet across character and monster roles. Verify shared positions, explicit apply, validation and recovery, dependent statistics, read-only behavior, and keyboard focus.

Edit multiple fields and an entry without using individual Apply actions. Verify Done applies the pending changes and returns to view mode. Repeat with a rejected draft and verify edit mode stays open, the rejected change has actionable feedback, and unapplied drafts survive. Correct the draft and verify Done completes. Phase 24 will verify the equivalent Save flow, including an unchanged file when a draft is rejected.

- All 497 unit tests and 36 packaged smoke tests passed. Type checking, formatting, and whitespace checks passed. The Windows package was built in the isolated copy from V1.
- The [creation scenario](../../tests/smoke/sheet-creation.spec.ts) verified identical label order, keyboard focus, and no horizontal overflow at 360 pixels. It checked individual Agility Apply, several pending drafts on Done, an accepted Toughness edit surviving a rejected Strength edit, retained Agility and entry drafts, rejection focus, and corrected Done. It also verified that adding, replacing, and removing an effect-bearing entry updates Strength Bonus, that discarding a draft preserves accepted values, and that returning to the sheet retains its latest in-memory revision.
- The [opening scenario](../../tests/smoke/sheet-loading.spec.ts) verified name and career applied together through Done on a saved character, editable opening for both roles, read-only opening without Edit, and unchanged saved files.

## V3 Manual walkthrough (SE-1, SE-4, SE-5)

Status: Not run by the user

1. Run `npm start` from the phase branch or launch the packaged app. Choose a disposable copy of [runtime-library](../../runtime-library).
2. For the saved-sheet cases, copy [the authored examples](../../data_contracts/examples/v2) into the disposable library. Under `RPG_systems/rogue-trader`, copy the example manifest to `manifests/<system version>/system.json` and its template to the same relative `templates` path used in the examples. Copy `explorator.instance.json` to `characters/explorator.json` and `ork-freebooter.instance.json` to `monsters/ork-freebooter.json`. Keep the active runtime manifest in place.
3. Create a character and choose **View sheet**. Press Enter on **Edit**. Change Agility to 42 and choose **Apply edits**. Verify Half Move updates to 4 and the sheet stays in edit mode. Enter a negative score and choose **Apply edits** again. Verify the previous stats remain visible and focus returns to the rejected field, then correct the draft.
4. Set Strength to 45. Under **Add rulebook entries**, choose **Traits**, open **Rulebook entry**, and type `strength` into that control. Select **Unnatural Strength (x2)** and choose **Stage entry**, then **Done**. Verify Strength Bonus is 8 and the trait appears with its rulebook citation. Return to the main page and choose **View sheet** again to verify the accepted values are still present.
5. Open the saved monster. Change its name and Agility and choose Done. Check the new name and updated Movement in view mode. Repeat by entering an invalid score first and then changing the name. Verify you can correct the score without losing the name draft. Repeat the mode switch in a narrow window.
6. Rename the copied monster's exact archived manifest in the disposable library and reopen the monster. Verify it retains its layout and stored statistics, explains read-only mode, and offers no Edit action. Restore the archive after checking.

## V4 Sticky edit bar (SE-7)

Status: Passed on 2026-11-24

Type checking, formatting, whitespace checks, and all 497 unit tests passed. The isolated Windows package passed all 36 smoke tests. The focused creation scenario also passed with additional checks for applying multiple drafts together and discarding a staged entry removal. The test scrolled to the entry editor at 360 pixels wide and verified all three actions stayed fully in the viewport.

For the V3 walkthrough, use Apply edits in step 3 and use Done in step 4 after changing the field and entry. Scroll to an entry near the bottom of a narrow window and check that all three actions stay visible. Change a field or stage an entry removal, then choose Discard edits. Verify the accepted values and entry return and the sheet stays in edit mode.

## V5 Rulebook trait selections (SE-8)

Status: Passed on 2026-11-24

The bridge test rejected raw add and replace operations, unknown trait IDs, and requests with an extra effect argument. The Windows package passed the creation scenario with both rulebook choices visible, staged selection surviving a rejected field draft, and the ×2 effect updating Strength Bonus after Done. It also verified removal and discard. All 497 unit tests and 36 packaged smoke tests passed.

After walkthrough step 4, return to **Edit**, choose **Remove** on the trait, and use **Apply edits**. Verify that the bonus returns to its base value.

## V6 Searchable rulebook dropdown (SE-9)

Status: Passed on 2026-11-24

All 497 unit tests and 36 packaged smoke tests passed. The creation test verified both categories, the empty Talents results, case-insensitive matching, focus restoration after staging, and retention of pending entries after a rejected field edit.

For the walkthrough, use **Add rulebook entries**. Switch to Talents to see the empty results, switch back to Traits, search for `strength`, and select **Unnatural Strength (x2)** from the results dropdown. Choose **Stage entry**, then **Done**.

## Review follow-up

The packaged creation test verifies that choosing **Load system** again clears the prior creation result and its **View sheet** action. The full packaged suite passed all 36 tests, and all 497 unit tests passed.

## V7 Search inside the dropdown (SE-10)

Status: Passed on 2026-11-24

The packaged creation test verified category filtering, typing directly into **Rulebook entry**, Arrow Up and Arrow Down navigation, Enter selection, Escape dismissal, and a separate keyboard activation of **Stage entry**. All 36 packaged smoke tests and 497 unit tests passed.
