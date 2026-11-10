# Phase 16 validation

Run from the repository root with the locked Node and contract Python environments. Use disposable library copies and an isolated Electron profile.

## Step 1

- **V1 — Selected system and exact versions (LL-2, LL-4, LL-6).** Run `npm run test:unit -- tests/unit/main/definition-loader.test.ts`. Copy the runtime seed and add a second system with malformed definitions. Assert which payloads are read, confirm the other system is absent from the returned catalog, and verify the input files retain their bytes. Add an older supported archive and verify its exact pair resolves without reading the active pointer. **Status** Passed on 2026-11-09. File-read instrumentation recorded exactly the selected active manifest, its archive and its template. The malformed system was absent from the catalog and the files retained their bytes. The older pair read only its archive and requested template.
- **V2 — Invalid definitions and containment (LL-3, LL-4, LL-6).** Run the same focused suite with absent files or revisions, malformed JSON and UTF-8, duplicate keys, unsupported schema, path/identity mismatches, invalid template membership and an external link. Expect located diagnostics, no catalog on failure and no outside payload reads. **Status** Passed on 2026-11-09. All 18 loader tests passed, including static formula type and reference checks, a formula that would fail if evaluated, and a Windows junction that triggered zero payload reads.
- **V3 — Repository checks (LL-3, LL-6).** Run `npm run test:unit`, `npm run typecheck`, `npm run format:check`, `git diff --check`, and the Python contract and mypy commands in the [Windows validation workflow](../../.github/workflows/validation.yml). Expect all checks to pass. **Status** Passed on 2026-11-09. All 384 unit tests across 17 files, TypeScript, Prettier and Git whitespace checks passed. All 18 Python contract groups and mypy across 11 files passed.

After the Step 1 commenting review and strict JSON parser extraction, all 384 unit tests, TypeScript, formatting and whitespace checks passed again.

- **V6 — Product logging (LL-3).** Run the focused loader suite with the shared log service writing to a disposable app profile. Verify that active and exact loads correlate their start, milestones and outcome. A malformed template after a valid archive should record the archive milestone and the diagnostic code as the failure reason. Verify that neither paths nor definition data appear. Verify that a throwing sink preserves successful and rejected load results. **Status** Passed on 2026-11-09. All 20 loader tests passed, including the JSON Lines and failing-sink checks. The full 386-test suite, TypeScript, formatting and whitespace checks passed.

- **V7 — Strict JSON parser (LL-3).** Run [the focused domain suite](../../tests/unit/domain/strict-json.test.ts) with `npm run test:unit -- tests/unit/domain/strict-json.test.ts`. Verify object-local duplicate detection, escaped and empty property names, ignored key-like text inside strings, syntax errors, and valid values passed to downstream validators. **Status** Passed on 2026-11-09. All eight parser tests and all 394 unit tests passed. TypeScript, formatting and whitespace checks passed.

- **V8 — Event name and reason format (LL-3).** Run the logging contract and IPC failure tests in [the logging suite](../../tests/smoke/logging.spec.ts). A new dotted event and caller-owned failure reason persist through the main-process log service without registration. Invalid names and reasons fail format validation. A valid name or reason outside the renderer's permissions still fails at IPC. **Status** Passed on 2026-11-09. Both focused Playwright tests, all 394 unit tests, TypeScript, formatting and whitespace checks passed.

- **V9 — Deep formula diagnostics (LL-3).** Run the focused loader suite. Both active and exact loading accept a formula at 128 levels and return a library-relative `INVALID_VALUE` diagnostic for formulas at 129 and 1,501 levels. **Status** Passed on 2026-11-09. All 23 loader tests, all 397 unit tests, TypeScript, formatting and whitespace checks passed.

## Step 2

- **V4 — Selection state and process boundary (LL-1, LL-2, LL-5, LL-6).** Use two disposable folders and multiple systems, including malformed unselected content. Assert discovery reads no payloads. Exercise cancellation, selection replacement, invalid folders, startup with a missing remembered folder, restart, stale asynchronous completion and invalid IPC payloads/senders. Expect only the current system's catalog to remain owned by the application. Expect only the folder to persist across launches. Run V3 again, then `npm run package` and `npm run test:smoke`. **Status** Passed on 2026-11-09. The [selection tests](../../tests/unit/main/library-selection.test.ts) instrumented definition reads, simulated delayed results, exercised preference recovery and write failure, and verified IPC rejection. The [packaged tests](../../tests/smoke/library-selection.spec.ts) exercised keyboard controls with a simulated picker result and relaunched against the same profile. All 405 unit tests, 45 smoke tests (9 project-specific skips), TypeScript, Prettier, whitespace checks, 18 contract tests, mypy and Windows x64 packaging passed.
- **V5 — Required human keyboard walkthrough (LL-1, LL-2, LL-5, LL-7).** Launch the packaged app with a disposable profile. Using only the keyboard, open the native folder picker, cancel, and verify focus returns to the invoking control. Reopen it, choose a copy of the runtime library, and verify the system options have readable labels. Select Rogue Trader and verify success feedback. Switch to a malformed system and verify text identifies the problem and offers recovery. Verify focus remains visible and that a screen reader announces status and errors. Recover by selecting Rogue Trader, restart, and verify the folder is remembered while the system must be selected again. Record the app build, OS, assistive technology and observed results. **Status** Not run. The automated keyboard test substitutes a picker result. Human verification of the native dialog and screen-reader announcements is pending.

- **V10 — Review regressions (LL-2, LL-3, LL-5, LL-7).** The loader tests cover a 7,000-field acyclic dependency chain, exact filename casing, and unsupported schemas with a different shape. The packaged test pauses the selected manifest read, reloads the window, and verifies that the completed selection and status appear in the new renderer. **Status** Passed on 2026-11-10. The reload regression failed against the previous package and passed against the rebuilt package. All 408 unit tests, 46 desktop smoke tests (10 project-specific skips), Windows x64 packaging, TypeScript, formatting, whitespace, 18 Python contract tests, and mypy passed.

- **V11 — Version consistency and picker cancellation during reload (LL-3, LL-5, LL-7).** The domain tests check the runtime schema version against the three v2 schema files. The packaged test pauses a system load, reloads the window, then cancels or rejects the folder picker before releasing the load. The panel retains the picker feedback and restores the completed system. **Status** Passed on 2026-11-10. Cancellation reproduced the stale panel on the prior package. All 411 unit tests, TypeScript, formatting, whitespace checks, 18 Python contract tests, and mypy passed. The full smoke suite passed 48 tests with 12 project-specific skips. All five packaged library tests passed after the final rebuild.

### Windows walkthrough setup

Run from the repository root after `npm run package`. Keep this PowerShell session open so the relaunch uses the same disposable profile.

```powershell
$demo = Join-Path ([IO.Path]::GetTempPath()) ('rpg-buddy-phase16-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $demo | Out-Null
$library = Join-Path $demo 'library'
Copy-Item .\runtime-library $library -Recurse
$broken = Join-Path $library 'RPG_systems\malformed'
New-Item -ItemType Directory -Path $broken | Out-Null
Set-Content -LiteralPath (Join-Path $broken 'system.json') -Value '{invalid' -Encoding utf8
$profile = Join-Path $demo 'profile'
$exe = '.\out\RPG Buddy-win32-x64\RPG Buddy.exe'
Write-Host "Choose this library in the picker: $library"
& $exe "--user-data-dir=$profile"
```

Tab to **Choose library folder** and press Enter. In the native picker, press Escape to cancel, then verify focus returns to the button. Reopen it and use the keyboard to choose the printed library path. Tab to **Game system**, choose `rogue-trader`, then tab to **Load system** and press Enter. Repeat with `malformed`, confirm the error is announced, and recover by loading `rogue-trader` again. Close the app and rerun `& $exe "--user-data-dir=$profile"`. Check that the folder is restored and **Game system** starts at **Choose a system**.
