# Phase 25 validation

## V1 Windows validation (MV-4)

Status: Passed on 2026-11-26.

The starting application passed formatting, TypeScript, whitespace, all 499 unit tests, all 18 Python contract tests, strict mypy on 11 files, and Windows x64 packaging. The Electron baseline passed 57 tests with 17 intentional project-specific skips. This local run used Node 26.13.0, npm 12.2.1, and the existing Python 3.12.1 verification environment.

Use the repository's declared Node and npm versions and Python verification dependencies. Run `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `python data_contracts/verify_contracts.py`, `python -m mypy --strict --no-namespace-packages data_contracts/verification data_contracts/verify_contracts.py`, `npm run package`, `npm run test:smoke`, and `git diff --check`. Expect every command to succeed. Report intentional project-specific skips.

## V2 Packaged desktop restart (MV-1, MV-2)

Status: Passed on 2026-11-26.

The [restart scenario](../../tests/smoke/milestone-restart.spec.ts) passed three consecutive standalone runs in the Windows package using `npm exec -- playwright test --project=packaged tests/smoke/milestone-restart.spec.ts --repeat-each=3`. It saved a character with Strength 45 and Bonus 8 and a monster with Strength 55 and Bonus 10, both with Unnatural Strength (x2). The first process exited with code 0. The next process restored the same library, reopened both roles by keyboard, and displayed 11 for the monster after that value was inserted into its disposable snapshot. Both files retained their exact pre-open contents.

The full Electron suite with this check passed 58 tests with 18 intentional development-project skips. TypeScript passed again after the test was added.

The first test draft generated a synthetic change event on the already-selected character role, which left a pending focus request in the UI. It also matched role text in both the sheet and hidden pickers. The final test selects a role only when it changes and scopes the role assertion to the displayed sheet.

Launch the Windows package with an isolated profile and disposable runtime library. Use the desktop UI to create one sheet of each role, edit a characteristic and a reviewed trait, verify the resulting bonus, and save. Fully exit, then launch again with the same profile and library. Reopen both sheets and verify names, IDs, roles, source values, effects, recorded bonuses, and unchanged files. Use a deliberately different recorded bonus on one valid snapshot to distinguish loading from recalculation.

## V3 Failure paths and diagnostics (MV-3)

Status: Passed on 2026-11-26.

- [Packaged sheet saving](../../tests/smoke/sheet-saving.spec.ts) rejected invalid Strength for both roles, restored input focus, and retained staged traits and primary file contents. A simulated outstanding save lock preserved the prior primary and accepted edits. Retry saved successfully and retained the previous primary as the exact backup. Missing archived definitions opened the monster read-only with the saved result and no save actions.
- [Packaged sheet loading](../../tests/smoke/sheet-loading.spec.ts) covered invalid files and read-only feedback. [Definition loader tests](../../tests/unit/main/definition-loader.test.ts) verified unsupported definitions, exact-version resolution, and correlated success and failure diagnostics without definition contents.
- [Domain edit tests](../../tests/unit/domain/edit-instance.test.ts) verified that arithmetic overflow reports a diagnostic, preserves the last valid sheet, and permits a corrected edit. [Sheet bridge tests](../../tests/unit/main/sheet-creation.test.ts) verified safe workflow logging and save recovery.

Inspect and run the existing unit and desktop scenarios for invalid drafts, incompatible definitions, calculation failures, a failed save and retry, and missing exact definitions. Expect actionable feedback, preserved valid state or disk bytes, preserved stored results in read-only mode, and privacy-preserving workflow records. Record the relevant test evidence.

## V4 Human walkthrough (MV-1 through MV-4)

Status: Passed on 2026-11-26.

The user reported completing the walkthrough and confirmed that the workflows behaved as expected. Earlier walkthrough feedback about the creation form was addressed in V5.

From the repository root in PowerShell, prepare and launch an isolated copy:

```powershell
$milestoneRoot = Join-Path ([IO.Path]::GetTempPath()) ("rpg-buddy-milestone-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $milestoneRoot | Out-Null
$milestoneLibrary = Join-Path $milestoneRoot 'library'
$milestoneProfile = Join-Path $milestoneRoot 'profile'
Copy-Item -LiteralPath './runtime-library' -Destination $milestoneLibrary -Recurse
& './out/RPG Buddy-win32-x64/RPG Buddy.exe' "--user-data-dir=$milestoneProfile"
```

1. Choose the copied library at `$milestoneLibrary` using **Choose library folder**, select Rogue Trader, and choose **Load system**.
2. Use the creature template to create a character named `Milestone Character` and a monster named `Milestone Monster`. Check their distinct sheet IDs. For each, press Enter on **View sheet** and verify focus moves into the sheet.
3. In each sheet, set **Strength** to `-1` and activate **Apply edits**. Verify feedback identifies Strength and focus returns to the input. Correct it to `45` for the character and `55` for the monster. Select **Unnatural Strength (x2)** in **Rulebook entry**, choose **Stage entry**, and activate **Apply edits**. Verify Strength Bonus is `8` for the character and `10` for the monster.
4. Use Tab or Shift+Tab to reach **Save**, then press Enter. Verify **Sheet saved.** and confirm the JSON file appears in `RPG_systems/rogue-trader/characters` or `RPG_systems/rogue-trader/monsters` in the copied library. Choose **Done**, then **Back to main page**.
5. Fully close the app and rerun the last PowerShell command in the same terminal. Verify the library folder is remembered, then select and load Rogue Trader. In **Load a saved sheet**, select the matching role and reopen each sheet. Verify its name, ID, Strength, trait, and bonus. Confirm **Edit** is available.
6. In the copied library only, read `system.version` in the saved monster JSON. While the system is still loaded, temporarily rename `RPG_systems/rogue-trader/manifests/<system.version>/system.json` (version `1.0.1` in the bundled library). Reopen the monster. Verify the read-only explanation, the same trait and bonus, and the absence of edit and save controls. Restore the manifest when finished.
7. Report the outcome for each role and any unexpected behavior.

## V5 Creation form stale result (MV-5)

Status: Passed on 2026-11-26.

The [packaged creation scenario](../../tests/smoke/sheet-creation.spec.ts) verified that a name edit immediately clears the success message and disables View sheet. Reverting the text and a rejected duplicate-ID submission both leave View sheet disabled. A later successful creation restores the action and opens the new sheet. The Windows rebuild passed all 58 Electron smoke tests with 18 intentional development-project skips, all 499 unit tests, all 18 contract tests, TypeScript, strict mypy, formatting, and whitespace checks.

In the packaged Windows app, create and view a character, then go back and edit the display name. Verify that the old success message clears, View sheet is disabled immediately and after a rejected creation, and a new successful creation enables View sheet and opens its own snapshot.
