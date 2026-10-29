# Diagnostic Logging Plan Update

## Purpose and starting point

This documentation-only planning update adds field-diagnostic logging to the roadmap early enough to guide subsequent development. It is not the implementation specification for Phase 5.

- Branch: `replan/2026-10-29-diagnostic-tracing`.
- Starting base: `main`, commit `66a1575c3fde61971cc42b7a53b670953794fc70`.
- Initial working tree: clean. User-local date: 2026-10-29.

## Work completed

- [x] Reviewed the existing roadmap, architecture and desktop-shell logging behavior.
- [x] Agreed to schedule Diagnostic logging after Secure application boundary and before Domain module foundation.
- [x] Inserted logging as future Phase 5, renumbered later phases to 6–20 and preserved completed Phases 1–3.
- [x] Recorded JSON Lines for rotating files and readable text for the development console, plus agreed high-level retention, privacy and support decisions in architecture guidance.
- [x] Updated roadmap references and labeled these documents as a planning update.
- [x] Removed premature implementation tasks, detailed runtime requirements and future runtime validation procedures. Those will be generated when the logging phase is undertaken.
- [x] Checked documentation links, numbering, formatting and documentation-only scope; results are recorded in validation.md.

## Outcome

The roadmap and architecture now include diagnostic logging for field reports. No application code, dependencies or runtime behavior changed. Phase 5 remains incomplete and requires its own dated implementation specification when that work starts.
