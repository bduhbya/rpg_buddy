# Phase 24 validation

## V1 Save bridge (SA-1, SA-2)

Status: Passed on 2026-11-25

Run `npm run typecheck`, `npm run test:unit`, `npm run format:check`, and `git diff --check`. Use a disposable library and exercise the trusted handler against the real safe saver. Verify sender and payload rejection, role destination resolution, stale handles, overlapping saves, stale on-disk baselines, first write, failed overwrite and retry, backup bytes across unchanged saves, and privacy-preserving diagnostics. Verify that read-only opening provides no editable capability.

- `npm run typecheck`, `npm run format:check`, and `git diff --check` passed. `npm run test:unit` passed all 499 tests across 25 files.
- [The save bridge cases](../../tests/unit/main/sheet-creation.test.ts) used disposable libraries and the real main-process workflows for both roles. They verified untrusted senders, malformed requests, cross-role destinations, stale edit and selection revisions, overlapping saves, locked primary retry, exact backup bytes across unchanged saves, and rejection of a second editor whose baseline changed. They also reopened and saved both roles, removed the exact manifest to verify read-only capability invalidation, and checked representative save logs for outcomes, reasons, and absence of private values.

## V2 Packaged desktop (SA-3, SA-4, SA-5)

Status: Passed on 2026-11-25

Run `npm run package` and `npm run test:smoke:package` using disposable libraries. Exercise first Save in edit mode, disabled Save on clean sheets, the Done prompt, keyboard access, both roles, pending draft rejection and correction, disk failure and retry, read-only mode, and reopen with identity, source values, effects, and stored results intact.

- The Windows build from `npm run package` passed all 37 tests in `npm run test:smoke:package`. Type checking, formatting, and whitespace checks passed, along with all 499 unit tests.
- The [save scenario](../../tests/smoke/sheet-saving.spec.ts) used keyboard activation in edit mode for both roles. It verified destination labels, the enabled first save, disabled Save after saving and reopening, draft rejection and focus, an unchanged primary after draft and write failures, preservation of accepted drafts for retry, exact backup bytes, and reopening with identity, source values, effects, and derived results. With the exact manifest absent, a read-only sheet retained its stored results and offered no save controls.
- The [creation scenario](../../tests/smoke/sheet-creation.spec.ts) verified the save controls stayed within the viewport at 360 pixels while editing lower sections. The [loading scenario](../../tests/smoke/sheet-loading.spec.ts) verified that view mode hides save controls and that discarding pending and applied changes restores the last saved snapshot. The creation scenario exercised dialog cancellation and Save and finish.

## V3 Manual walkthrough (SA-3, SA-4, SA-5)

Status: Not run by the user. The walkthrough is available for optional manual verification. V2 supplies the acceptance evidence.

1. Launch the Windows package or run `npm start`. Choose a disposable copy of [runtime-library](../../runtime-library) and load Rogue Trader.
2. Create a character. Choose **View sheet** and verify it opens in edit mode. Confirm **Save location** ends in **Characters**, then press Shift+Tab from that selector to **Save** and press Enter. Verify the app announces **Sheet saved.** and disables **Save** until you make another edit. Verify that `RPG_systems/rogue-trader/characters/<sheet-id>.json` exists in the disposable library.
3. In edit mode, give Strength a negative value, and stage **Unnatural Strength (x2)** using the **Rulebook entry** picker. Choose **Save**. Verify the error names Strength, focus returns to its input, the staged trait remains, and the file is unchanged.
4. Write an empty file named `<sheet-id>.json.lock` beside the saved sheet. Correct Strength to 45 and choose **Save**. Verify the lock diagnostic appears, the sheet retains Strength 45 and the accepted trait, and the primary is unchanged. Remove the test lock and choose **Save** again. Compare the new primary and the `.json.bak` predecessor.
5. Choose **Done**, then **Back to main page**. Open the sheet from **Load a saved sheet**. Verify its name and ID, Strength 45, Strength Bonus 8, and the trait. Confirm view mode hides the save controls. Choose **Edit** and verify **Save** is disabled. Change a field and choose **Done**, then **Discard changes**. Verify the original value returns. Repeat steps 2–5 for a monster, using **Monsters** and the `monsters` directory.
6. Without reloading the active system, rename the exact archived manifest indicated by the monster's saved system version under `RPG_systems/rogue-trader/manifests/<system version>/system.json`. Open the monster again. Verify that its values and trait are present, the read-only message appears, and there is no **Save** or **Save location**. Restore the archived manifest.

## Review follow-up

Status: Passed on 2026-11-25

The packaged save scenario verified that both roles normalize `045` to `45`, disable Save when pending or applied edits restore the saved value, and exit through Done without a prompt. The bridge suite submitted a snapshot with only its modification timestamp changed and verified that the primary and prior backup remained byte-for-byte intact. All 499 unit tests and 37 packaged smoke tests passed.

The rebuilt package also verified that pasting a number surrounded by whitespace strips leading zeros. An editable monster with a stored Strength Bonus different from its formula result kept Save enabled and prompted on Done when a draft restored the stored Strength score but recalculated the bonus. Save and finish persisted the recalculated bonus and retained the exact prior file as the backup. The preview bridge unit checks covered sender authorization, rejected discard payloads, and stale revision rejection. All 499 unit tests and 37 packaged smoke tests passed after these changes.
