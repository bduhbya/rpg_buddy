# Phase 13 requirements

## Context

Phase 12 delivered in-memory instance creation. Phase 13 in the [roadmap](../roadmap.md) reorganizes the domain before Phase 14 adds editing and recomputation. The [mission](../mission.md), [technology boundaries](../tech-stack.md), [v1 contract](../../data_contracts/contracts.md), and [replan](../2026-11-05_replanning-domain-readability/requirements.md) govern this work.

## Scope

**DR-1.** Organize domain implementation files by responsibility. Group definition validation, indexing and resolution in `definition-processing/`, put type-only modules and shared definition patterns in `definitions/`, separate instance creation, and group calculation and effects in the second step. Keep cross-cutting types and validation utilities shared. Improve local names, comments and the living [architecture guide](../../src/domain/architecture.md) where they clarify ownership or control flow. Editing, loading, persistence and UI belong to later phases.

## Product decisions

The folder layout should help a maintainer find the owning code for each workflow. Definition and creation callers import directly from the owning modules.

## Technical requirements

**DR-2.** Preserve exported signatures, v1 data and fixtures, diagnostic codes, messages, locations and ordering, provider call order, copy ownership, and calculation semantics. Keep the domain independent of frameworks and platform I/O.

## Accessibility requirements

The phase changes internal domain code and developer documentation. It introduces no interactive surface. Existing diagnostic content remains available for accessible presentation by callers.

## Completion requirements

**DR-3.** A reader can trace exact definition resolution, in-memory creation and calculation with effects from the guide into the owning modules. Existing unit, type, contract, formatting and whitespace checks pass. The walkthrough is recorded for review.
