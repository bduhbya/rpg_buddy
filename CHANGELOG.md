# Changelog

Entries summarize development changes by date and may be updated before committing.

## 2026-11-25

- Added library saving for Rogue Trader characters and monsters. Newly created sheets open in edit mode on their first visit. The edit toolbar shows **Save** and the role-specific library destination. Users can save a new sheet without editing it, and successful saves refresh the saved-sheet list. Read-only sheets have no save controls.
- Added a **Done** prompt for unsaved changes with options to save, discard, or keep editing. Pending edits are checked using the same calculations as **Apply edits**, and numeric fields strip leading zeros even when pasted with surrounding whitespace. Invalid drafts block saving, and failed writes leave accepted edits available for retry.
- Protected saved sheets against stale edits and preserved the previous backup when a save leaves sheet content unchanged. Added automated coverage for saving and reopening both roles, retrying a failed write, and preserving recorded and recalculated results.

## 2026-11-24

- Added a shared, full-window Rogue Trader sheet for newly created and loaded characters and monsters. The centered layout shows identity, characteristics and bonuses, entries, and stored movement values. Read-only sheets use the same layout and explain when exact definitions are unavailable.
- Replaced inline previews with a **View sheet** button inside each creation or loading form. **Back to main page** restores the form and keyboard focus to the button that opened the sheet.
- Added in-place editing for newly created and editable loaded sheets. A sticky bar lets users apply pending edits, finish editing, or discard drafts. Accepted mechanical changes update derived statistics, and rejected edits keep the remaining drafts available for correction.
- Added a searchable rulebook picker with Traits and Talents filters. The initial choices are Unnatural Strength and Unnatural Toughness. Results summarize their effects, and staged traits show the full description, a worked example, and the rulebook citation before the edits are applied.

## 2026-11-20

- Added a desktop picker for saved character and monster sheets. Choices show the display name and stable ID. Opening shows stored statistics without recalculating or changing the file, explains read-only mode when a matching system or template version is unavailable, and reports invalid-file diagnostics.
- Displayed the full library path in the operating system's native format. Listing and opening show progress and disable conflicting controls. Cancelling or rejecting a folder choice preserves the selected sheet and preview, and keyboard focus returns to the folder picker.

## 2026-11-19

- Added desktop creation of in-memory character and monster sheets from active templates. The form suggests an ID from the display name, accepts a custom ID, reports collisions, and previews initial values and calculated statistics.

## 2026-11-14

- Added main-process saving for validated character and monster sheets. Saves preserve stored results, stage writes before replacement, and keep the previous valid revision as an overwrite backup. Documented manual recovery for interrupted saves.
- Split the planned desktop loading and saving interfaces. Scheduled a shared Rogue Trader display for characters and monsters between loading and editing, using the manual's character sheet as the visual specification. The component owns layout, and a configurable presentation specification is deferred until after the first milestone.

## 2026-11-10

- Added desktop library selection and exact-version definition loading for the selected system. The app remembers the library folder across launches.
- Added main-process loading for saved character and monster sheets. Opening preserves recorded results without recalculation and allows read-only viewing when exact definitions are unavailable.
- Standardized diagnostic logging across application workflows with stable event names, separate step and outcome fields, and correlated checkpoints. Documented logging conventions for the domain, main process, renderer, and IPC boundary.

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
