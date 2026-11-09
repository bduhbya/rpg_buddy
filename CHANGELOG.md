# Changelog

Entries summarize development changes by date and may be updated before committing.

## 2026-11-09

- Completed Phase 15. New character and monster instances carry final statistics and presentation data. Edits that change source values or effects update the sheet and its results atomically. Descriptive and equivalent edits preserve the recorded results.
- Adopted a complete v2 bundle for system, template, and instance schemas. Updated the Rogue Trader seed definitions to `1.0.1` and retired the prerelease v1 schemas, fixtures, and `1.0.0` seed definitions. Added contract checks for empty value maps and trailing newlines in field IDs.

## 2026-11-07

- Added in-memory editing of source values, names, careers, and instance entries. Mechanical edits recompute derived values, and invalid edits preserve the prior state. Moved document models and structural validation into their domain folders and documented the editing API.
- Planned self-contained instance sheets before filesystem work. The roadmap calls for loading recorded results and allowing read-only viewing when exact definitions are unavailable.

## 2026-11-05

- Added in-memory character and monster creation from exact system and template versions, with independent default values, IDs, and timestamps.
- Grouped domain code by responsibility and documented how exact definition resolution, instance creation, and calculation fit together.

## 2026-11-04

- Implemented derived-statistic calculation in dependency order and applied explicit instance-entry effects after each affected base result. Moved arithmetic acceptance to TypeScript and retained Python checks for contract and fixture integrity.
- Added Rogue Trader seed definitions for the approved core-statistics slice, including the shared creature template and versioned system manifest.

## 2026-11-02

- Added structural validation for system manifests and templates, plus an in-memory catalog that resolves exact definition versions. Invalid documents, conflicting definitions, and unavailable references return diagnostic codes and locations.

## 2026-10-30

- Added a Windows GitHub Actions workflow for pull-request validation, covering formatting, TypeScript, unit tests, Python contract/type checks, packaging and both Electron test modes, with failed-test diagnostic artifacts. Enabled main-branch protection requiring passing GitHub Actions checks and an up-to-date PR, including administrators; added LF checkout attributes for consistent Windows formatting.

- Added framework-independent TypeScript declarations for system manifests, templates, expressions, instances, selected entries and effects, and diagnostics. These represent the existing v1 contracts; runtime validation and calculation remain future work.
- Established a Vitest unit-test harness using the existing character, monster and shared creature-template fixtures, with compile-time contract cases, independent fixture loads and domain dependency checks. Added the unit-test command and completed the domain foundation phase documentation.
- Refocused the README on project purpose and current capabilities, setup and build instructions, important commands, and basic diagnostics.

## 2026-10-29

- Defined versioned JSON contracts and schemas for manifests, templates and saved instances, including exact references, restricted expressions, numeric semantics, diagnostics and library paths. Characters and monsters now share a creature template, with roles, descriptive selections and explicit effects owned by each instance. Added example data and a modular, typed Python contract verifier with independent worked cases and debugging support.
- Established a runnable Electron, React and TypeScript desktop shell with Forge/Webpack development and Windows packaging, pinned dependencies, formatting tools and Playwright smoke checks. Split the roadmap into smaller verifiable phases.
- Added a sandboxed renderer, narrow typed preload API, runtime-validated application-information IPC, trusted-sender checks and navigation restrictions. The interface displays application information with loading and failure feedback.
- Implemented bounded local diagnostic logging with rotating JSON Lines files, sanitized correlated events, build identification, debug controls and simulated diagnostic failures. Added concurrent-writer coordination, restart recovery and best-effort fatal-error recording, plus logging and application-boundary checks with isolated temporary test profiles.
- Documented the separation between generic template modifier targets and future reusable feature catalogs, with independent instance snapshots and explicit upgrades reserved for later implementation.

## 2026-10-28

- Established the project mission, architecture and phased roadmap for a desktop RPG companion, initially covering a bounded Rogue Trader character and monster workflow.
- Reviewed the supplied core rulebook and agreed on representative editable characteristics, derived bonuses and movement, source references, worked examples, boundary cases and exclusions. Recorded the approved source-review scope before application implementation.
