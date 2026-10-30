# RPG Buddy

A desktop RPG companion for players and game masters. The current application is a minimal runnable shell; character sheets, rules and local libraries arrive in later phases.

## Development setup

Use Node.js **26.13.0 or newer** and npm **12.2.1 or newer**. These were the latest stable versions checked on 2026-10-29. Node's bundled npm may be older; after installing current Node, update npm with `npm install --global npm@12.2.1` if needed. Check `node --version` and `npm --version` before installing. Development and packaging have been verified on Windows x64 only.

From the repository root:

```powershell
npm ci
npm run typecheck
npm start
```

Forge builds the main process and preload, serves the React renderer locally on `127.0.0.1:5173`, and launches Electron. Keep that port free; an occupied port fails rather than selecting another silently. Renderer edits rebuild through Webpack; reload the window to see them. The development browser client and hot reload are disabled because its Node shims are incompatible with Electron 45 sandbox preloads. Restart development after main/preload edits. Forge uses a localhost renderer URL backed by the loopback development server. Close the application window to stop development. Do not set `ELECTRON_RUN_AS_NODE` when launching the desktop application.

## Production build and launch

```powershell
npm run package
& '.\out\RPG Buddy-win32-x64\RPG Buddy.exe'
```

The output is a runnable application directory, not an installer. Keep the complete directory together. It bundles renderer assets and runs without a development server or installed Node. Build output is ignored by Git. Installer generation, signing and distribution are deferred.

## Verification

```powershell
npm run typecheck
npm run package
npm run test:smoke
```

The Playwright suite reports 43 passed checks and seven explicit development skips across development and packaged projects. Logging adds privacy, storage, independent writer concurrency, error-capture, keyboard diagnostics and packaged fatal-error checks. Two boundary/adapter cases per project verify malformed payloads, sender/frame identity checks, response validation and safe transport errors without launching Electron. Focused shell tests cover startup/application information/reload, bridge/frame/navigation restrictions, and narrow layout with doubled text in both modes. Three packaged-only IPC tests cover real rejection from a foreign window and malformed requests from a test-only preload, accessible feedback when application information is unavailable, and continued application-info operation when logging transport fails. Two further packaged-only tests verify fatal exception/rejection recording and nonzero exit. These five checks, the packaged native-menu test and the concurrent profile-isolation test are explicitly skipped in development. A shared test-scoped fixture launches a fresh application for every shell test, checks renderer/asset diagnostics and clean window-close exit, and always attempts process cleanup and diagnostic capture. Test preloads are external automation fixtures and are excluded from the application package by Forge's normal packaging filter. Each development launch uses a temporary localhost debugging port and closes its own process tree on failure. No separate Playwright browser download is needed: the tests use Electron's Chromium.

Run only one mode with `npm run test:smoke:dev` or `npm run test:smoke:package` (package first for the latter). Do not run development, packaging and smoke commands concurrently: Forge shares `.webpack/` build output. Test screenshots and diagnostic JSON are written under `test-results/`, replaced by the next run. Current evidence and a human walkthrough are recorded in [Phase 4 validation](specs/2026-10-29_secure-application-boundary/validation.md); [Phase 3 validation](specs/2026-10-29_desktop-shell/validation.md) records the original shell.

## Source layout and boundaries

- `src/main/`: Electron window lifecycle and document loading.
- `src/preload/`: sandbox-compatible application-info and validated diagnostic logging bridge.
- `src/shared/`: application-info and logging contracts, logging interface/no-op and runtime validation; no Electron or filesystem imports.
- `src/renderer/`: React screen and styles; no filesystem or Electron imports.
- `tests/smoke/`: development and packaged launch checks.
- `data_contracts/`: existing language-neutral contracts, examples and Python verification tooling; see its [README](data_contracts/README.md).
- `specs/`: constitution, roadmap and phase specifications.

Context isolation, disabled renderer Node integration and sandboxing are explicit startup defaults. The preload exposes `window.rpgBuddy.getApplicationInfo()` and the bounded `recordLog()` endpoint described below. Application information returns a discriminated success/failure result with app name/version and Electron/Chrome/Node versions. It sends a fixed `{ apiVersion: 1 }` request on `application:get-info`; the main process validates the argument count, exact payload, owning webContents, main frame and canonical document URL. Invalid requests return `INVALID_REQUEST`, untrusted senders return `FORBIDDEN`, and transport/response failures become `UNAVAILABLE`. No raw IPC, filesystem API, Electron objects or error stacks cross the bridge. Unexpected document navigation, new windows and webview attachment are denied. The screen announces loading and safe failure feedback. Phase 5 implements local diagnostic logging as described below. Forge uses its supported Webpack plugin. Playwright's Electron support is experimental upstream; exact dependency versions and `package-lock.json` preserve the verified combination. Upgrade intentionally and rerun both modes.

Build configuration lives in webpack.main.config.cjs and webpack.renderer.config.cjs. Babel strips TypeScript syntax and transforms JSX; `npm run typecheck` performs strict checking separately, so packaging alone is not a type check. Vitest remains the planned domain unit-test framework in the constitution; unit-test installation and fixtures arrive with the domain phase.

Dependency audit: the supported Forge Webpack plugin currently brings four moderate development-only audit findings through webpack-dev-server -> sockjs -> uuid (GHSA-w5hq-g745-h8pq). These tools are not application runtime dependencies. The server is restricted to loopback. No force downgrade or unverified major dependency override was applied. Track upstream remediation and rerun the smoke checks when upgrading.

## Formatting

Run `npm run format` to format supported source, configuration, JSON fixtures and Markdown files, or `npm run format:check` to check without writing. Prettier is pinned locally and configured for two spaces, single quotes in JavaScript/TypeScript, semicolons, trailing commas, a 100-column print width and LF line endings. Markdown prose wrapping is preserved. Generated output, environments, caches and the npm-maintained lockfile are excluded by .prettierignore. Python files are outside Prettier's supported languages.

VS Code recommends the Prettier extension and enables format-on-save only for supported languages using this repository's config. Install the recommended extension to enable editor formatting; CLI commands work independently. Existing Python debugger/tasks remain in place.

## Diagnostic logging and support collection

Phase 5 adds a shared typed logger, main-process rotating JSON Lines files and a runtime-validated renderer endpoint. No automatic telemetry or upload occurs. The screen's **Simulate diagnostic failure** button records a caught renderer failure and a caught main-process failure using the same session and operation IDs. It does not crash the application. The live status reports the operation ID after queue acceptance; this is not a guarantee of durable delivery if storage subsequently fails.

Logs live in Electron's application user-data directory, under `logs/`. On Windows the default is `%APPDATA%\RPG Buddy\logs`. The active file is `application.jsonl`; archives are `application.1.jsonl` through `application.4.jsonl` (newest first). Each file is at most 5 MiB and the five managed files total at most 25 MiB across simultaneous application launches. Rotation replaces the oldest archive. Close all app windows before copying the files so the collection is consistent. Find the operation ID from the screen in the files; include the matching session ID, app version and a description of the action that failed when manually sharing logs with support.

The default threshold is info. In the application menu, choose **Diagnostics > Enable debug tracing** to toggle debug logging immediately. The checkbox applies to this launch only; other concurrent processes keep their own setting. Relaunching restores the environment-based startup default. Each change records diagnostic.debug.enabled or diagnostic.debug.disabled at info level; enabling also writes an application.debug marker with the same operation ID. Disabling suppresses new debug records while preserving info/warn/error/fatal logging and records already queued. No renderer permission or restart is needed to toggle it. For debug logging enabled at startup in PowerShell:

```powershell
$env:RPG_BUDDY_LOG_LEVEL = 'debug'
& '.\out\RPG Buddy-win32-x64\RPG Buddy.exe'
Remove-Item Env:\RPG_BUDDY_LOG_LEVEL
```

Development console output uses readable text from the same sanitized events. Records contain UTC time, event/severity, session and operation UUIDs, source/PID and app/runtime versions. Error messages, arbitrary context, character/campaign contents, credentials, paths, filenames and function text are omitted. Sanitized errors retain a standard error type and up to 16 stack line/column locations labeled `[source]`; match these against the corresponding application build when investigating. Review files before sharing: version and activity metadata may still be sensitive. Nothing uploads automatically.

The main process serializes writes with an exclusive filesystem lock shared by launches. The queue holds at most 128 records, records are at most 8 KiB, renderer acceptance is limited to 30 requests/second, and lock contention expires after two seconds. Saturation or storage failures drop records without stopping normal application work; internal bounded queue and written/dropped/failure counters are available on the service for tests and diagnostics. The service safely reclaims writer locks belonging to dead PIDs. A reused PID, incomplete lock-owner write or abandoned `.recovery.lock` is treated conservatively: logging may remain unavailable. After closing **all** RPG Buddy processes, remove only `logs/.writer.lock` and `logs/.recovery.lock` if present, then restart. Do not remove locks while an application is running. Complete records survive ordinary restart and an incomplete final append is removed before new writes. Unexpected main exceptions/rejections attempt to drain logs and exit with code 1; renderer errors/rejections and renderer termination are recorded. Abrupt crashes, OS shutdown, power loss and unavailable storage cannot guarantee final delivery; records are not fsync-backed transactions.

Logging infrastructure checks use the existing Playwright TypeScript runner and temporary directories, including independently bundled child-process writers. The desktop suite also verifies keyboard diagnostics, actual packaged logs, real IPC rejection and fatal termination. See `specs/2026-10-29_diagnostic-logging/validation.md` for current evidence and the human support walkthrough. The framework-independent interface and no-op logger live in `src/shared/logging-contract.ts`; future domain code can accept that interface without importing Electron or file storage.

### Finding a diagnostic in source

Use the stable `event` as the primary source-search key. For example:

```powershell
rg -n -F "'diagnostic.main.failure'" src
rg -n -F "'INVALID_REQUEST'" src/main
```

The event identifies where the log was recorded, which may be a catch block rather than the original throw site. Keep names literal and give each name one stable meaning; future operations should pass one operation UUID across related log entries. The closed event/reason vocabularies are in `src/shared/logging-contract.ts`.

| Event                                                             | Recording site / meaning                                     | Known reason codes                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `application.started`, `application.stopped`, `application.debug` | Main lifecycle / opt-in debug                                | None                                                                 |
| `application.startup.failed`                                      | Creating/loading the application window failed               | `WINDOW_STARTUP_FAILED`                                              |
| `application.fatal`                                               | Main process must terminate                                  | `UNCAUGHT_EXCEPTION`, `UNHANDLED_REJECTION`, `WINDOW_STARTUP_FAILED` |
| `application.info.failed`                                         | Application-info IPC rejected or could not finish            | `INVALID_REQUEST`, `FORBIDDEN`, `UNAVAILABLE`                        |
| `diagnostic.request.rejected`                                     | Logging IPC rejected a request                               | `INVALID_REQUEST`, `FORBIDDEN`, `RATE_LIMITED`                       |
| `diagnostic.renderer.failure`, `diagnostic.main.failure`          | Diagnostic button's correlated simulated failures            | `SIMULATED_FAILURE`                                                  |
| `renderer.error`, `renderer.rejection`, `renderer.terminated`     | Unexpected renderer errors/rejections or process termination | None; do not guess the underlying cause                              |

`reason` contains a closed category for known failures, never exception text. Rejection summaries are throttled to at most one per second per handler; some repeated or different rejected requests in that interval will intentionally have no separate entry. Backend drops/failures use counters rather than recursively writing to a failing logger.

Every new record has a main-stamped `buildId`. It combines the Git revision (or `nogit` for source archives), a 20-hex SHA-256 fingerprint of the sorted application source/assets and build/config/dependency inputs, the build mode, and host platform/architecture. Uncommitted application changes affect the fingerprint; docs/tests/generated output do not. Git is used only at build time. This labels build inputs rather than hashing the final executable; retain the corresponding packaged artifact and source maps for support. Restart development after source/config changes to refresh the main process and its build identifier; live renderer-only edits otherwise still use the running main process's identifier until restart.

Sanitized stacks are **retained as fallback evidence** and explicitly labeled `stackFormat: compiled-js`. Their `[source]:line:column` locations refer to generated JavaScript, not repository TypeScript. Filenames and functions remain omitted for privacy, so locations can be ambiguous, especially across bundled/vendor frames. No source-map translation is implemented in this phase. Use event/reason/build identifiers first. Older records without the new metadata remain in the files until normal retention removes them; they are not rewritten.

Runtime debug transition events are diagnostic.debug.enabled and diagnostic.debug.disabled (info severity, no reason code); the native checkbox remains usable with standard OS menu keyboard navigation. Native keyboard/screen-reader verification is documented as a supplementary manual check in the phase validation.

### Logging module responsibilities

| Module                            | Responsibility                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/main/logging.ts`             | Concrete logging service: queue, severity threshold, file coordination and rotation                         |
| `src/main/logging-ipc.ts`         | Main-process logging IPC validation and diagnostic request handling                                         |
| `src/shared/logging-contract.ts`  | Framework-independent types, event/reason vocabulary, no-op interface implementation and runtime validation |
| `src/renderer/renderer-logger.ts` | Renderer error/rejection listeners and safe forwarding through the preload bridge                           |

### Automated profile isolation

All application tests now pass a factory-owned temporary `--user-data-dir` before Electron starts. This routes startup logs and Chromium profile data away from your normal RPG Buddy profile. Packaged checks assert the actual native userData path; development and packaged shell checks require startup and correlated diagnostic records in the temporary directory. The menu restart check reuses only its own temporary profile to verify environment defaults without hiding unintended persistence. Other independent tests use distinct profiles.

After process termination, the profile fixture attaches up to the final 64 KiB of each diagnostic file and a cleanup manifest under test-results attachments, removes the verified temporary root, and asserts that it no longer exists. The isolation regression runs a separate temporary application with protected evidence and an active writer lock; another test application must succeed without changing those files. No test sentinels or locks are written to the real application profile. Logs written by older test versions to your real profile are left untouched.

Expired queued records are now dropped before lock acquisition and rechecked before append, including time spent preparing/recovering files. Newer unexpired records can still be written. An append that has already started finishes its JSON line; JavaScript cannot interrupt an OS filesystem call already in progress.
