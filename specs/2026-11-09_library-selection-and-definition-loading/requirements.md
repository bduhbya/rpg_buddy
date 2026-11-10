# Phase 16 requirements

## Context

[Phase 15](../2026-11-07_self-contained-instance-sheets/plan.md) produces complete sheets in memory. Phase 16 gives the main process read-only access to the [runtime definitions](../../runtime-library/README.md) through the canonical layout in the [data contracts](../../data_contracts/contracts.md#identity-versions-and-library-paths). The [constitution](../tech-stack.md) defines process boundaries. The [roadmap](../roadmap.md#phase-16-loading-scope-requirement) limits loading and retention to the selected system. Existing [domain APIs](../../src/domain/README.md#in-memory-definition-catalog-api) validate and resolve definitions independently of the filesystem.

## Scope

Select and remember a local library, discover system IDs, load the selected system's active definition catalog, and expose a main-process exact archived lookup for Phase 17. Phase 17 owns opening saved sheets and classifying editing availability. Phase 18 owns saving sheets. Phase 19 owns template selection and sheet creation UI. Shared rules, feature libraries, seed installation, definition editing and upgrades, and schema migrations remain outside this phase.

## Product decisions

- **LL-1.** Choose a library folder using a native directory picker. Accept a readable folder containing an ordinary RPG_systems directory. An empty systems directory is valid. Remember only the accepted folder in the local app profile. Preserve the prior selection if discovery or the preference write fails. Start each launch with no system selected. Cancellation preserves the current selection. If a remembered folder becomes unavailable, explain how to choose another folder.
- **LL-2.** Discover immediate system directories by stable ID under `RPG_systems` using directory metadata. Library selection and discovery read no definition payloads. Selecting a system loads that system only. Unselected systems may contain malformed files without preventing a valid selection. Show actionable feedback for missing, unreadable, malformed, incompatible or unsupported definitions.

## Technical requirements

- **LL-3.** Keep filesystem access in the main process. Build definition paths from validated IDs and exact versions. Reject path traversal, symbolic links and junctions beneath the resolved library root. Decode UTF-8 strictly and reject invalid JSON and duplicate keys. Apply v2 structural validation, canonical identity checks, cross-document resolution, and static formula type and dependency checks. Runtime validation allows at most 128 levels per formula, counting its outermost expression as level one. A deeper formula returns a located diagnostic before dependency analysis or catalog construction. Formula evaluation belongs to creation and editing. Return diagnostics with library-relative document labels and JSON pointers. Read definitions without modifying the library. Use the shared main-process logging service for correlated load outcomes. Record starts and manifest, archive and template validation milestones at debug level. Record successful outcomes at info level and rejections with the diagnostic code as the log reason. Keep library paths, IDs and document data out of log records. A logging failure must preserve the loader result. The containment checks assume the directory tree is stable during a read.
- **LL-4.** Active loading reads the selected system's `system.json`, its declared archive, and the exact templates listed in that manifest. Active and archived manifest contents must agree. Publish the catalog only after every listed pair resolves. An explicit exact lookup reads the named archived manifest and requested template only, verifies membership and identity, and returns the pair using the existing resolver. It uses no active pointer, substitutes no other version, and retains no additional catalog.
- **LL-5.** Main-process selection state owns at most one active catalog. Changing the system or accepted folder releases the old catalog immediately. A failed system load leaves no active catalog. A superseded load must never publish, and cancellation before accepting a new folder preserves the active catalog. Keep folder paths and filesystem APIs out of the renderer request surface. Apply the existing trusted-frame and runtime payload checks to new IPC.

## Accessibility requirements

- **LL-7.** The desktop user can choose a folder, cancel, choose a discovered system and retry using only the keyboard. Use labeled native or semantic controls, visible focus, and textual selection and failure feedback announced to assistive technology. Return focus to the invoking control when the picker closes. Step 1 provides logical document names and plain-language diagnostics for this feedback and adds no UI controls.

## Completion requirements

- **LL-6.** Load the checked-in Rogue Trader seed from a disposable library and resolve its exact pair. Show that an older supported archive remains addressable after the active version changes and that missing or unsupported versions fail. Instrument reads to show that malformed unselected definitions are neither read nor cataloged. Check malformed input, invalid paths and linked components without changing source files.
- Demonstrate folder preference recovery and restart behavior, cancellation, catalog replacement and release, and rejection of stale loads and untrusted IPC. Pass required automated checks and the human keyboard walkthrough in [validation](validation.md).
