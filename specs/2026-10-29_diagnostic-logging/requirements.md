# Phase 5 — Requirements

## 1. Context

The roadmap's next incomplete phase is Diagnostic logging. The constitution (`../mission.md`, `../tech-stack.md`, `../roadmap.md`) and diagnostic-logging planning update are authoritative. Phase 4 established the isolated renderer and validated application-info bridge. Logging precedes domain implementation and must preserve those boundaries.

## 2. Scope

Shared logging API, local main-process storage, renderer transport, error/lifecycle integration, diagnostic failure button, tests and support collection documentation. Excludes telemetry, automatic upload, log viewer/export UI, game data, domain implementation and dependency upgrades.

## 3. Product decisions

Use info by default; `RPG_BUDDY_LOG_LEVEL=debug` explicitly enables debug. Store UTF-8 JSON Lines in Electron `userData/logs`. One active 5 MiB file plus four archives; total managed content at most 25 MiB across concurrent launches. Keep launches independent and coordinate storage. Users share files manually. Show a labeled diagnostic button and understandable live status containing a correlation ID; it deliberately records a caught renderer/main failure pair.

## 4. Technical requirements

- LOG-1: Framework-independent typed Logger with no-op implementation. Closed event vocabulary and bounded structured records; no arbitrary data/context/messages. Sanitize stack locations, omit error messages and paths, reject malformed transport data and unknown keys. Sanitization must not throw on hostile values.
- LOG-2: Main owns one serialized service, bounded records (8 KiB), queue (128 records) and retry deadline (2 seconds). Rotate before exceeding the limit. Coordinate launches with an exclusive lock, recover dead owners, preserve complete valid JSON Lines on restart, and recover incomplete trailing writes. Persistent logging failures and saturation drop records safely and expose bounded counters; no unbounded retry or recursive logging.
- LOG-3: UTC timestamps, stable event, severity, session UUID, operation UUID, process source/PID, application/runtime versions and sanitized errors. Main supplies trusted metadata; correlate renderer/main diagnostic records by operation and session. Validate owning webContents, main frame, canonical document URL, exact request and bounded response. Rate limit renderer acceptance to 30 records per second per owner; reject excess without queueing.
- LOG-4: Same sanitized events produce readable development console text. Debug is opt-in. Logging never breaks ordinary operations. Graceful exit drains with a deadline. Unhandled main exceptions record best-effort fatal information and exit nonzero; unexpected rejection is fatal. Record renderer error/rejection and renderer-process termination without forwarding raw error text. Abrupt process death cannot guarantee final delivery.
- LOG-5: Diagnostic button works with keyboard, reports completion/failure without crashing or replacing current UI. A logging failure does not prevent application-info display.

## 5. Accessibility requirements

Native labeled button, visible keyboard focus and live status. Correlation ID wraps at narrow widths and doubled text. Preserve existing headings, landmarks and accessible application-info failures. Record manual screen-reader/OS-zoom checks honestly.

## 6. Completion requirements

LOG-6: Required automated storage, privacy, IPC, failure and desktop checks pass; strict typecheck, formatting, package build and development/packaged smoke tests pass. README documents location, debug opt-in, retention, collection and privacy limitations. Validation records actual evidence and human checks remaining. Mark roadmap complete only after required automated checks pass.

## Diagnostic identifiers refinement

- LOG-7: Stable event names must be literal searchable names with documented meanings. Add an optional closed `reason` enum for known categories (simulation, IPC invalid/forbidden/unavailable/rate-limit, window loading and main exception/rejection). Reject arbitrary reasons and renderer-supplied build metadata. Mark retained sanitized stack positions with main-stamped `stackFormat: compiled-js`; legacy records are left intact. No repository-line mapping is performed. Throttle rejection summaries to at most one per second per handler so hostile calls do not create an unbounded log flood; preserve existing safe response behavior. Do not recursively record backend failure reasons into the failed backend.
- LOG-8: Every new file record and development console event includes a trusted build identifier, generated during compilation with no runtime Git requirement. Include revision when available, a stable digest of maintained application/build inputs (including uncommitted source, assets and dependency lockfile), mode and host platform/architecture. A source archive without Git uses an explicit `nogit` prefix. Identical inputs/mode yield an identical identifier; relevant changed inputs or mode change it. This is a build-input fingerprint, not a cryptographic hash of the distributed executable. No user data, paths, credentials or timestamps enter the identifier.
- LOG-9: Validate reason privacy/transport, retained compiled stack labeling, input fingerprint behavior, searchability of recording sites, actual packaged simulation and IPC reasons/build metadata, then typecheck, format, package, full smoke and whitespace checks. Document `rg` search and distinguish known reason categories from unexpected failures. Existing accessibility behavior is unchanged. Source-map translation remains future scope.

## Runtime debug menu refinement

- LOG-10: Add native Diagnostics > Enable debug tracing checkbox, initialized from the main logger's startup setting (RPG_BUDDY_LOG_LEVEL=debug). Preserve standard application menu functions. Changes affect subsequent events in this launch only; do not persist preferences or affect other concurrent processes. Keep the renderer boundary unchanged. Log stable info events diagnostic.debug.enabled/diagnostic.debug.disabled for actual changes; emit one application.debug marker on enable to prove debug delivery. Disabling suppresses new debug records, not previously accepted records; info/warn/error/fatal continue. No arbitrary message/context fields are added.
- LOG-11: Test toggling the live service both ways, idempotent changes and environment-default initialization. Packaged automation verifies native checkbox label/type/state, invokes its native callback, and inspects actual logs for enable/disable and correlated debug marker; restarting resets to the selected startup default. Native keyboard menu operation is a reproducible supplementary human check. Re-run established regression/build checks and document this session-only setting.

## Module naming refinement

- LOG-12: Give each logging module a role-specific basename: src/shared/logging-contract.ts for interface/types/validation, src/renderer/renderer-logger.ts for renderer error forwarding, src/main/logging-ipc.ts for validated main IPC, and src/main/logging.ts for the concrete service. Preserve runtime behavior, exports, data contracts, menu operation and privacy. Update imports/tests/documentation links and require typecheck, formatting, packaging, full smoke and whitespace checks to pass. No interface accessibility behavior changes.

## Independent review fixes

- LOG-13: All desktop automation (development shell, packaged shell, menu and fatal tests) must select an exclusive temporary userData profile on the process command line before app startup. Independent launches receive distinct profiles; the menu restart scenario deliberately reuses only its own disposable profile to verify that settings are not persisted. Do not redirect after logger initialization or merely change the directory used by assertions. Assert startup logs in that profile and actual app.getPath('userData') where main automation is available; dev checks must prove startup and simulated records land there. Remove profiles only after their processes terminate; preserve diagnostics as attachments outside the disposable profile. Regression tests must demonstrate separate launches have independent logs and evidence in an unrelated simulated normal profile remains unchanged. Never create test sentinels or locks in the actual user profile.
- LOG-14: An entry whose deadline is at or before the current time must be dropped before acquiring storage and rechecked before its individual append. Once contention clears, an expired entry must not be written, while a still-valid newer entry can be written. The existing OS-call preemption limitation remains: an append already in progress cannot be canceled by JavaScript.
- LOG-15: Add targeted regressions for deadline boundary, delayed retry after lock release, mixed-age queue, profile uniqueness/startup routing and successful cleanup. Demonstrate the critical expiry test fails with the old service ordering. Run typecheck, format, package, complete smoke suite and whitespace checks. Manual accessibility/platform limitations are unchanged.

Implementation detail for LOG-14: expiration is checked before lock acquisition, between queued records, after restart inspection and immediately before the first append byte. After append begins, the writer completes the JSON record rather than intentionally leaving a partial line. Regression coverage additionally advances the clock during real restart-record inspection, proving that a pump-only deadline check is insufficient.
