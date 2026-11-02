# Phase 8: Definition dependency resolution - Plan

Topic branch: `phase/2026-11-02-definition-dependency-resolution`, created and verified before phase files. Starting base: `main` at `d2e235ab999f10858d3b5aab5701cfc7b41ed239`; working tree initially clean. User accepted existing v1 scope, proposed validation and pauses after each step on 2026-11-02.

## Step 1: Validated in-memory source

- [x] P1 (DR-1, DR-4): Add source construction from parsed, logically named documents using existing validators and isolated snapshots. Complete when invalid bundles expose no partial source and caller edits cannot alter indexed definitions.
- [x] P2 (DR-2): Add exact system/template lookup and content-aware conflict detection. Complete when exact versions and namespaces are respected, identical duplicates accepted, and missing/unsupported/conflicting definitions have actionable diagnostics.
- [x] P3 (DR-1, DR-2, DR-4): Add focused tests and API documentation, run step checks and record evidence.

Human checkpoint: stop after validated step 1 and await feedback before step 2.

## Step 2: Cross-document resolution

- [x] P4 (DR-3): Resolve a requested pair through the catalog and check manifest membership and exact template.system agreement, with related diagnostic locations.
- [x] P5 (DR-3, DR-4): Add integration/negative cases, document resolution flow, run agreed checks and record phase completion. Mark roadmap complete only once all requirements pass.

Step 2 depends on reviewed step 1. No calculation, shared-rule contract revision, instance loading or application integration is included. Keep source/tests mirrored. Split further if the change ceases to be comfortably reviewable.

## Progress

Specifications recorded before implementation. Step 1 implemented and validated on 2026-11-02. The user reviewed the concept, requested renaming DefinitionSource to InMemoryDefinitionCatalog, and explicitly authorized step 2. Renamed the interface, constructor, module, mirrored test and documentation. Step 2 implemented and phase validation passed on 2026-11-02; see validation.md. Phase complete. No subsequent phase starts here.
