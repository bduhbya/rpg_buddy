# Phase 5 — Validation

All activities below were defined before implementation. Initial status: Not run.

| Activity                           | Method / expected result                                                                                                                                                                                                                                                                                                           | Status / evidence                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Privacy and contract (LOG-1,3)     | Infrastructure tests: hostile errors, paths, credentials, game contents, oversized/unknown fields, invalid UUID/event/severity; only closed sanitized data survives, no throw. Check no-op and severity filtering.                                                                                                                 | Passed — see execution evidence below                                                                |
| Storage (LOG-2)                    | Temporary directories and reduced limits: many records rotate before limit, five files/total bound, parse every line; restart retains complete records, repairs interrupted tail; dead lock recovery.                                                                                                                              | Passed — see execution evidence below                                                                |
| Concurrency and failures (LOG-2,4) | Independent child processes write to one directory; validate unique complete records and limits. Force unwritable storage, contention and queue saturation; bounded drops and continued caller execution.                                                                                                                          | Passed — see execution evidence below                                                                |
| IPC (LOG-3)                        | Tests reject foreign senders/subframes/URLs, wrong arity, malformed/oversized payload and floods; validate safe response/transport failures. Packaged real bridge preserves isolation.                                                                                                                                             | Passed — see execution evidence below                                                                |
| Desktop (LOG-3,4,5)                | Keyboard-activate diagnostic in development and package; status exposes UUID; inspect files for paired sanitized main/renderer records and trusted metadata. Check narrow layout. Verify fatal termination through an isolated packaged process.                                                                                   | Passed — see execution evidence below                                                                |
| Regression/build (LOG-6)           | `npm run typecheck`, `npm run format:check`, `npm run package`, `npm run test:smoke`, `git diff --check`; all pass.                                                                                                                                                                                                                | Passed — see execution evidence below                                                                |
| Human support walkthrough          | Launch packaged executable, Tab to Simulate diagnostic failure, press Enter, copy operation ID, close app, collect userData/logs files and locate ID with session, error type/stack. Restart and verify normal info. Optional debug: launch with RPG_BUDDY_LOG_LEVEL=debug. Use screen reader and OS zoom to confirm status/focus. | Not run; human-only screen-reader/OS checks are supplementary and do not block automated completion. |

## Execution evidence — 2026-10-29

- Privacy and contract: **Passed**. Tests reject unknown fields, bad events/severities/UUIDs and oversized or unsanitized stacks; strip sample credentials, user paths, game contents and function text; handle throwing getters; validate safe preload failures, debug filtering and no-op use. Development console receives only sanitized formatted records.
- Storage: **Passed**. Reduced 1,000-byte limits force rotation across exactly five files and verify every file/aggregate bound and every retained JSON line. Restart preserves the prior complete record and removes an interrupted final append. Real production defaults are 5 MiB per file, four archives and 8 KiB per record; reduced limits exercise the same writer algorithm.
- Concurrency and failures: **Passed**. Three independently launched Node processes write 30 records each into one shared directory: all 90 retained with unique operation IDs. Two independent processes force concurrent rotation and validate bounds/JSON. A known dead writer PID is reclaimed. A live writer lock, two-record queue and 40 ms test retry window force ten bounded drops; an invalid directory and oversized record fail safely. Each process gets an isolated session UUID. The production retry window is two seconds and queue bound is 128.
- IPC: **Passed**. Infrastructure tests exercise foreign identities, missing/subframes, wrong URLs, arity/shape/event restrictions, rate limiting and transport failures. Real packaged tests reject both application-info and logging requests from a foreign window; a test-only main-frame preload verifies ten malformed calls across the two endpoints. Removing the logging handler gives understandable status while application-info requests still succeed.
- Desktop: **Passed**. Development and packaged tests focus the native button, activate with Enter and receive an operation UUID. Packaged files contain exactly the paired main/renderer events for that operation, one session, source/PID, UTC timestamps, versions and sanitized nonempty stack positions. Dispatched ErrorEvent and PromiseRejectionEvent exercise installed renderer listeners and produce sanitized records. Actual isolated packaged main-process exceptions and unhandled Promise rejections each record a sanitized TypeError and exit with code 1. Existing fresh-process startup/reload/security/layout checks pass. The existing screenshot at test-results/shell-shell-remains-readab-8a4a3-rrow-width-and-doubled-text-packaged/shell.png was visually inspected: the new control and text wrap correctly at narrow width and doubled text.
- Regression/build: **Passed**. `npm run typecheck` passed; `npm run package` produced the Windows x64 application. Final `npm run test:smoke`: **27 passed, 5 skipped (15.7 seconds)**. Skips are explicit development-only exclusions: three packaged IPC cases and two actual packaged fatal-process cases. Formatting and whitespace checks are recorded below after final documentation updates.
- Human support walkthrough: **Not run by a human**. Automated keyboard, correlation, packaged-file and layout checks cover the reproducible core scenario. Screen-reader, OS zoom and non-Windows verification remain unperformed supplementary checks. No claim of those checks passing is made.

## Limitations

No telemetry, viewer/export, raw error text or arbitrary context. Stack locations intentionally omit filenames/functions; diagnosis must use the matching build. Queue acceptance is not a disk durability receipt. Abrupt crashes and unavailable storage can lose records. An incomplete lock-owner write, reused PID or abandoned recovery guard can require manual lock cleanup with all app processes stopped; see README. Rotation and restart inspection perform bounded synchronous filesystem operations, so an OS-level stalled filesystem cannot be interrupted by the retry deadline. Persistent logging failures do not cause recursive reporting or stop application-info operations. Renderer-process termination recording is implemented but force-crash automation was not performed; exception/rejection listener integration and main fatal handling were tested as described above.

Final documentation checks: **Passed** — npm run format:check and git diff --check completed successfully after the README, roadmap and evidence updates. Phase 5 completion requirements are met; supplementary human checks remain explicitly unperformed.

## Identifier refinement — checks defined before implementation

Status: Not run. LOG-7–9 require exact reason validation (including malicious/unknown text and metadata spoofing), disk/console build metadata, explicit compiled stack format, deterministic build ID generation/change detection across source/config/lockfile/mode and no-Git source archives, literal event call-site inspection, packaged paired simulation reasons and IPC rejection reasons, followed by typecheck, formatting, production packaging, complete smoke suite and whitespace checks. Existing documented human-check limitations remain unchanged.

## Identifier refinement — execution evidence, 2026-10-29

Status: **Passed**. This supersedes the earlier 27-test count for the final implementation.

- `npm run typecheck`: Passed.
- `npm run package`: Passed; Windows x64 packaged output rebuilt with the identity plugin.
- `npm run test:smoke`: **31 passed, 5 skipped (16.9 seconds)**. The five skips remain the explicitly packaged-only development exclusions.
- Expanded logging infrastructure tests reject free-text/object reason values and renderer-supplied build/stack-format metadata. Verify build IDs in console/disk records and compiled stack labels. Source-archive fixtures prove deterministic IDs, source/config/lockfile changes, mode changes, relocation without path leakage and the no-Git fallback. Existing independent-process rotation/recovery and privacy checks still pass.
- Known IPC-category tests verify FORBIDDEN, INVALID_REQUEST, UNAVAILABLE and RATE_LIMITED reasons; repeated rejections produce at most one summary per handler/window. A throwing logger cannot alter the application-info failure reply. Renderer attempts to claim main-only reason categories are rejected.
- Packaged diagnostic-button records share one build/session/operation ID, both have SIMULATED_FAILURE, and both retain labeled sanitized compiled positions. Actual foreign-window calls produce application.info.failed and diagnostic.request.rejected with FORBIDDEN and trusted build metadata. Fatal exception and rejection tests verify their distinct reason codes and compiled stack labels while retaining the nonzero exit behavior.
- Source search inspected with `rg -n -F "'diagnostic.main.failure'" src` and `rg -n -F "'INVALID_REQUEST'" src/main`: event searches locate the vocabulary and recording site; reason searches locate rejection branches. README now catalogs existing event names/reasons and explains the distinction between the recording site and throw origin.
- Source-map translation was not added. Older log records remain unchanged; source positions still refer to generated JavaScript. Current manual accessibility/platform limitations remain as previously recorded. Build IDs are input fingerprints, not final executable hashes; retain matching build artifacts for any later source-map work.

## Runtime debug menu — checks defined before implementation

Status: Not run. Unit/infrastructure tests must demonstrate initial off/on defaults, enable/disable filtering, idempotence, preserved non-debug events and session-only state. Packaged native-menu automation must inspect the checkbox, exercise its callback and verify real info/debug log records and matching operation IDs. Re-run typecheck, package, complete smoke suite, formatting and whitespace checks. Manual verification: open packaged application, use Alt/native menu navigation to Diagnostics > Enable debug tracing, toggle on/off and confirm checkmark and log events; relaunch and confirm startup default. Screen-reader/native keyboard walkthrough remains supplementary and must not be claimed if not executed.

## Runtime debug menu — execution evidence, 2026-10-29

Status: **Passed** for LOG-10–11 automated completion. Final full suite: **34 passed, 6 intentional development skips (18.4 seconds)**. This supersedes the earlier suite counts. The additional skip is the packaged-only native-menu test.

- Infrastructure test verifies initial off and opted-in on states, enable/disable filtering, no duplicate transitions, non-debug severity retention, shared transition/marker operation ID and fresh-service defaults.
- Packaged native-menu automation runs four fresh launches with startup debug off/off/on/on. It verifies Diagnostics and the checkbox's label/type/checked state, retained standard menus, two-way changes using Electron's native MenuItem.click wrapper, actual disk records and the correlated debug marker. Each launch is left in the opposite state before closing; the following launch restores its environment default. Each application exits cleanly with code 0 after the ready heading has appeared.
- `npm run typecheck`, `npm run package`, `npm run format:check` and `git diff --check` passed. Packaging produced updated Windows x64 output. No new dependency, renderer API, message or context field was introduced.
- Supplementary human native-menu keyboard/screen-reader verification: **Not run**. The manual procedure above remains available. No persistence or cross-process synchronization of the debug preference is intended; previously queued debug records may still drain after disabling.

## Module naming — checks defined before edits

Status: Not run. Verify LOG-12 through import/path inspection, `npm run typecheck`, `npm run format:check`, `npm run package`, `npm run test:smoke` and `git diff --check`. Expect unchanged logging, bridge, menu and error behavior with no stale module references in maintained source, tests or documentation. No new test cases are required for this file organization change.

## Module naming — execution evidence, 2026-10-29

Status: **Passed**, LOG-12 complete. Only the concrete service is now named logging.ts; contracts, IPC and renderer adapter have distinct names. Updated all imports, the build-fingerprint source fixture path, README responsibility table and existing phase documentation links. Inspected src/tests/specs/README for stale logging/service, shared/logging.ts and renderer/logging.ts references: none remain. No behavior or exports changed and no new test cases were added.

`npm run typecheck`, `npm run package`, `npm run format:check`, `git diff --check` passed. Full `npm run test:smoke`: **34 passed, 6 intentional development skips (18.4 seconds)**, including packaged menu, fatal/error capture, security, logging privacy/storage/recovery/concurrency and development startup. Existing supplementary human-check limitations remain unchanged.

## Independent review fixes — validation defined before implementation

Status: Not run. LOG-13–15 require temporary per-launch profiles for all Electron launch sites, actual startup-path assertions, cleanup assertions and an untouched simulated normal-profile sentinel. Deadline tests must hold a live writer lock, let a queued entry reach/exceed its deadline, release contention before the next pump, and require a drop/no append; a mixed-age case must preserve the newer valid entry. Include exact-boundary and per-record recheck coverage where practical. First run the new expiry regression against the existing service to establish a meaningful failure, then implement the correction. Rerun typecheck, format, package, all smoke checks and whitespace checks, recording actual results.

## Independent review fixes — execution evidence, 2026-10-29

Status: **Passed**. LOG-13–15 complete; both review findings corrected. This section supersedes earlier suite counts and the former use of normal application profiles in desktop tests.

### Meaningful failing regressions

Before correcting pump ordering, the two new expiry tests failed as expected: a record queued under a live lock was written when released exactly at its deadline (written 1 instead of 0), and a mixed-age queue wrote both entries rather than dropping the expired entry (written 2/dropped 0 instead of written 1/dropped 1). The same tests pass after the fix, including an 80 ms late retry against a 40 ms test deadline.

A further regression advanced time while the actual restart inspection parsed an existing valid record. It failed with a pump-only correction (written 1/dropped 0 instead of 0/1). Adding the append-level deadline checks made it pass while preserving the original file byte-for-byte. These tests use node:test mocks for Date.now and targeted JSON parsing, restoring mocks in finally; they do not depend on arbitrary sleep durations or invoke private pump methods.

### Profile isolation and cleanup

All application launch sites now use the shared test-profile fixture and pass --user-data-dir before startup; application code does not gain a test-mode path override. The native switch is handled before JavaScript initialization in [Electron PreSandboxStartup](https://github.com/electron/electron/blob/main/shell/app/electron_main_delegate.cc), and the installed application's behavior was verified directly: packaged tests compare app.getPath('userData') to the requested directory; development/packaged shell tests require both startup and correlated diagnostic events there.

The profile-isolation regression launches two independent packaged applications in separate temporary profiles. One contains protected startup records, a sentinel archive and a live PID writer lock. The other must record startup and paired diagnostic events successfully without altering any protected log bytes/archive or lock contents. This would fail if either launch used the wrong/shared profile. The actual user's profile is never used for test sentinels or locks.

The menu restart test intentionally reuses only its own temporary profile across its four launches, preserving a real check against unintended setting persistence. Fatal tests also verify startup path/records before triggering crashes. Every profile tracks its child processes; teardown terminates survivors if necessary, verifies exit before deletion, captures bounded log tails to files/report attachments, checks the resolved root is factory-owned beneath the system temporary directory, removes it and asserts absence. Final artifact inspection found **18 cleanup-manifest entries: all processesTerminated=true, removed=true, and no root still present**. Actual retained profile-N-application.jsonl files exist under test-results outside the deleted profiles. Only the final 64 KiB of each diagnostic file is retained in test artifacts.

### Full validation

- `npm run typecheck`: Passed.
- `npm run format:check`: Passed; repeated after final documentation updates.
- `npm run package`: Passed, updated Windows x64 package includes append-level expiration checks.
- Final `npm run test:smoke`: **43 passed, 7 intentional development skips (21.9 seconds)** across 50 scheduled cases. Skips are packaged-only native/main-process tests, including the new simultaneous profile-inspection case. The full suite was repeated after adding on-disk diagnostic copies and cleanup manifests, so retained cleanup evidence corresponds to the final fixture implementation.
- `git diff --check`: Passed.

No new runtime dependency or renderer bridge was introduced. No new human accessibility/platform checks were performed. A started append still completes its JSON line; OS-level blocked I/O remains outside JavaScript cancellation guarantees. Earlier test events already written to the normal user profile were left untouched.

## Independent verification before integration — 2026-10-29

A fresh subagent with no conversation history performed a read-only review of both fixes, their tests, fixtures and specifications. Result: **No actionable findings; both prior findings fixed**. It independently ran typecheck, 11 logging infrastructure tests, the desktop cases (17 passed with seven intentional development skips), and whitespace checks. It also inspected all 18 cleanup-manifest entries: all processes terminated, all temporary roots removed, none remaining. The reviewer used the existing validated Windows package; it did not rebuild, rerun formatting, test other platforms or inject teardown failures. No source edits were made by the reviewer. The user authorized commit, merge into main and phase-branch deletion conditional on this clean review.
