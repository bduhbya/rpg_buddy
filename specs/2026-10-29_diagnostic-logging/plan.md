# Phase 5 — Diagnostic logging

Branch: `phase/2026-10-29-diagnostic-logging`. Starting base: `main`, commit `05f43c1`. Initial working tree clean. User confirmed plan, requirements and validation on 2026-10-29.

## Ordered tasks

- [x] Define a framework-independent logging interface, closed event vocabulary, bounded sanitized error representation, no-op implementation and validated IPC contracts (LOG-1, LOG-3).
- [x] Implement one main-process service, bounded queue, coordinated rotating JSON Lines storage, restart recovery and development console output (LOG-2, LOG-4).
- [x] Integrate lifecycle/error recording, validated renderer logging and a keyboard-accessible simulated-failure control with operation correlation (LOG-3, LOG-5).
- [x] Add adversarial storage/boundary and desktop tests, document local support collection, run checks and record evidence (LOG-6).

## Decisions

No new runtime dependency. Reuse Playwright's existing TypeScript test runner for infrastructure tests; Vitest remains scheduled for the domain phase. Main process stamps trusted metadata. Renderer supplies only closed event names, severity, UUID operation IDs and bounded sanitized errors. Do not persist arbitrary messages, context objects or error messages: these can contain credentials or game data. Stack evidence retains error type and compiled JavaScript line/column with paths and function text removed.

Use a short exclusive filesystem lock across launches; serialize each process through a bounded queue. Recover locks whose owner PID is dead, conservatively retain unknown/active locks and time out without affecting application operations. A separate recovery guard serializes stale-lock reclamation. No log content is stored outside the five managed files. Repair only an incomplete final record after interrupted writes; discard malformed records during bounded restart inspection. Simulated failures are caught deliberately and do not crash the app.

## Deviations and blockers

None at specification creation. Human OS/screen-reader checks will be reported separately from automated evidence.

## Implementation outcome

Implemented shared contracts/no-op and sanitization in src/shared/logging-contract.ts; bounded coordinated storage in src/main/logging.ts; trusted IPC in src/main/logging-ipc.ts; lifecycle/fatal integration in src/main/main.ts; renderer facade/listeners in src/renderer/renderer-logger.ts; native diagnostic control in src/renderer/main.tsx. README documents support collection. Tests live in tests/smoke/logging.spec.ts, logging-fatal.spec.ts and shell.spec.ts, with the independent writer fixture outside the dated specification folder.

The initial full suite exposed a test cleanup issue after expected process exit; caching its ChildProcess before termination fixed it. A strict typecheck caught an incorrect Electron evaluate callback signature in the expanded rejection test; corrected before the successful final run. These were test-harness issues, not accepted application defects.

Conservative coordination limitation: incomplete writer-owner files, PID reuse or an abandoned recovery guard are not automatically removed because doing so could race a live writer. Logging times out and drops records; the app remains usable. README specifies safe manual removal with all processes stopped. Dead, identifiable writer PIDs are recovered automatically and tested. Synchronous critical sections are bounded by managed file/record/queue sizes but slow or stalled operating-system filesystem calls cannot be preempted by a JavaScript deadline. There is no fsync durability guarantee. Human screen-reader/OS-zoom and other-platform checks remain unperformed; automated checks and visual inspection satisfy this phase's agreed completion criteria.

## Diagnostic identifiers refinement — 2026-10-29

User requested searchable event names, closed reason codes for known failures and a build identifier; source-map translation is deferred. Continue on the existing recorded phase branch and preserve prior changes.

- [x] Extend the closed log contract with reason codes and explicitly label retained stack positions as compiled JavaScript (LOG-7).
- [x] Stamp every record with a build-time identifier derived from Git revision, maintained application/build inputs and build mode/platform; distinguish uncommitted source changes without exposing paths (LOG-8).
- [x] Apply reasons at known simulation, startup, fatal-category and IPC rejection sites; throttle rejection summaries and never recursively log writer failures (LOG-7).
- [x] Test unknown reasons and metadata spoofing, searchable call sites, identifier stability/change detection and packaged reason/build records; rerun build and regression checks and document source search (LOG-9).

Decision: retain sanitized compiled stack line/column positions as secondary evidence, labeled `stackFormat: compiled-js`; do not claim repository source locations. Event names identify the recording site, not necessarily the original throw site. Reason codes are closed categories, not raw exception messages. Build IDs identify the build inputs/mode; preserve the actual matching artifact/source maps for any future translation. No UI changes or source-map translation are included.

Refinement completed: [shared contract](../../src/shared/logging-contract.ts), [trusted writer metadata](../../src/main/logging.ts), [build identity plugin](../../build/identity.cjs), [main IPC reasons](../../src/main/logging-ipc.ts), [application-info failure reasons](../../src/main/application-info.ts), [renderer simulation reason](../../src/renderer/renderer-logger.ts) and [source-search instructions](../../README.md#finding-a-diagnostic-in-source). No new dependency or UI control. Build fingerprints exclude documentation/tests/output; development requires restarting the main process to refresh metadata after edits. Source-map translation remains deferred. All LOG-7–9 checks passed as recorded in validation.md.

## Runtime debug menu refinement — 2026-10-29

User requested enabling/disabling debug tracing through the Electron menu. Continue this phase and its recorded branch; no new phase folder or renderer API.

- [x] Add mutable main-service debug threshold initialized from RPG_BUDDY_LOG_LEVEL, with runtime changes affecting subsequent records and sanitized enable/disable events (LOG-10).
- [x] Preserve standard application menus and add Diagnostics > Enable debug tracing as a native checkbox. Runtime changes apply only to this process/session and reset to the startup default on relaunch (LOG-10).
- [x] Verify threshold changes, info/error retention, menu checked state and packaged log output; rerun typecheck, package, smoke, formatting and whitespace checks, and update support instructions (LOG-11).

Runtime debug refinement implemented in [native menu](../../src/main/menu.ts) and [logging service](../../src/main/logging.ts). The main process initializes the menu during readiness, preserves existing menus (or builds standard role menus if absent), and updates one checkbox/service state. No renderer bridge additions or persisted settings. Stable transition events and the debug marker share operation correlation. [Packaged menu test](../../tests/smoke/menu.spec.ts) exercises Electron's MenuItem.click wrapper across four launches and verifies actual log output and environment-default reset. The first test version closed the window before load completion and triggered startup-error handling; waiting for the heading corrected the harness. The subsequent successful full suite is the completion evidence.

## Module naming refinement — 2026-10-29

User requested distinct logging module names for source clarity. Keep this phase/branch and preserve all behavior.

- [x] Rename shared logging contract to logging-contract.ts, renderer facade to renderer-logger.ts, and main IPC adapter to logging-ipc.ts; move the actual service to src/main/logging.ts (LOG-12).
- [x] Update imports, test source paths and maintained documentation links. Verify typecheck, formatting, production packaging, complete smoke suite and whitespace checks (LOG-12).

## Independent review fixes — 2026-10-29

User authorized fixing both fresh-review findings on the current phase branch.

- [x] Give every development/packaged test an exclusive temporary profile before main code/logging initializes (reuse only within the intentional restart scenario); assert actual profile and startup log location, clean up after termination, and verify unrelated profile evidence remains intact (LOG-13).
- [x] Drop expired queued records before acquiring the writer lock and recheck expiration immediately before each write (LOG-14).
- [x] Add regressions proving isolation/profile cleanup and expiration after contention clears, including records accepted before the deadline that must remain writable. Demonstrate the deadline regression fails against the previous ordering, then rerun full validation and update evidence (LOG-15).

Implementation now includes [test profile fixture](../../tests/smoke/fixtures/test-profile.ts), which selects --user-data-dir before Electron startup, validates native userData/startup logs, tracks child processes, captures bounded diagnostic tails and asserts cleanup of verified factory-owned temporary paths. Shell, menu, fatal and isolation launch sites all use it. The menu's restart scenario intentionally reuses only its own temporary profile so the no-persistence assertion is meaningful; independent tests never share profiles. The isolation regression uses two temporary applications and protects one profile with a live lock and sentinel archive; no sentinels/locks are placed in the actual user profile.

Three expiry regressions first failed against the relevant old behavior, then passed: exact/late retry after lock release; mixed old/live queued records; and expiration while inspecting prior valid records before append. Mocked time is restored in finally, and existing disk evidence must remain byte-identical when the expired new record is dropped.
