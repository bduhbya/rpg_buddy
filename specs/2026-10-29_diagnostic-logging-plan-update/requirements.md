# Diagnostic Logging Plan Update - Requirements

## Context and scope

This update records the user's request to introduce logging early for diagnosing field error reports. Its scope is roadmap ordering and high-level architecture decisions, not implementation of a logger.

## Agreed planning decisions

- Schedule Diagnostic logging as future Phase 5 after Secure application boundary; move the former Phases 5–19 to 6–20.
- Use a shared logging API with a main-process file writer and preserve the renderer/domain architecture boundaries.
- Use JSON Lines for rotating files and readable text in the development console.
- Retain the agreed high-level defaults in tech-stack.md: local application user-data storage, info with opt-in debug, 5 MiB per file and four archives, bounded retention, correlation and sanitized diagnostic context, safe concurrent launches, and manually shared logs without telemetry.

## Completion of this update

The roadmap ordering and architecture guidance are updated, these documents clearly identify a planning update, local links resolve and formatting checks pass. No UI changes are involved. Detailed API/data contracts, implementation tasks, backend choices, runtime acceptance requirements and test procedures will be specified when the logging phase is undertaken.
