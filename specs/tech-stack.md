# Technology and Architecture

## Baseline

- Electron for the desktop application.
- React for the interface.
- TypeScript for application code and the rules engine.
- Vitest for unit testing.
- Playwright for end-to-end testing.
- JSON flat files for system definitions, templates, and saved entities.
- A restricted declarative expression format for calculations; no executable JavaScript in data files.

Build tooling, UI libraries, and schema-validation tooling will be chosen in their phase specifications. A database is not required for the first milestone.

## Boundaries

The React renderer presents sheets and validation feedback. It does not access the filesystem directly. Electron's main process owns filesystem operations, exposed through a narrow, typed preload/IPC API. Enable context isolation, disable renderer Node integration, and validate requests at the process boundary.

The domain model, validation, and calculation engine are independent of React, Electron, and filesystem APIs. The persistence layer converts validated domain data to and from files. Both player and game master workflows will use these shared layers.

## Diagnostic logging

Introduce one shared, typed logging API in Roadmap Phase 5, after the secure application boundary and before domain implementation. The main process owns serialized file writes and rotation; renderer logging crosses a narrow runtime-validated IPC endpoint. Domain modules depend only on an injectable, framework-independent logging interface, with a no-op/test implementation available. Do not import Electron, filesystem APIs or the concrete logging backend into the domain. Process-local facades share one logging service rather than constructing unrelated logger instances.

Persist structured UTF-8 JSON Lines under the application user-data logs directory; render readable text in the development console using the same sanitized events. Default to info severity with explicit opt-in debug. Include UTC timestamps, stable event names, application/runtime versions, process identity, session/operation correlation and sanitized errors/stacks. No automatic telemetry or uploads. Users manually collect local files using documented support instructions.

Rotate before exceeding 5 MiB per file: one active file plus four archives, with at most 25 MiB of log content in total across concurrent application launches. Bound records and queues, coordinate writers, preserve valid records on restart, and prevent logging failures from breaking ordinary application operations. Best-effort fatal error recording must preserve appropriate process termination; abrupt crashes cannot guarantee final-record delivery. Exclude character/campaign contents, credentials and personal paths by default. The [Diagnostic Logging Plan Update](2026-10-29_diagnostic-logging-plan-update/plan.md) records this roadmap addition. Generate detailed implementation requirements, backend decisions and validation procedures when Phase 5 is undertaken.

## System definitions and templates

A system manifest identifies the RPG system, edition/source metadata, and available templates and shared rules. Stable identifiers connect these documents; filenames and display names are not entity identity.

Templates define an entity type, fields, types, initialization defaults, constraints, grouping, allowed modifier targets, and derived-statistic relationships. Characters and monsters share a creature template; their library/workflow roles belong to instances. Descriptive stable template IDs distinguish structures, while every definition file is named template.json. Keep formulas close to the fields they derive so a sheet's statistical model is readable in its template.

Reusable selectable features belong in a separate system-specific feature library, not in creature templates. Templates expose generic calculation/effect targets. Selection creates an independent entry snapshot with explicit effects; the instance retains the chosen data even if the library changes or is unavailable. Keep the feature's exact library identity/version as provenance separate from the instance-local entry ID and optional development metadata. Upgrades are explicit user actions validated before replacement; custom entries need no library origin. The library document/path/origin contracts and selection workflow must be specified before implementation. Current instance snapshots require no feature catalog at load or calculation time.

Separate rules documents are reserved for reusable mechanics shared across templates, such as common lookup tables or named calculations. Templates may reference those definitions through explicit, versioned dependencies. Do not duplicate a formula in both places or introduce a shared-rules abstraction before a concrete need is identified.

Rulebook citations are independent of development provenance. Phase/review/requirement references may appear only in optional documentary metadata and must not become runtime dependencies.

Presentation metadata describes semantic sections and ordering initially. Full visual replication of printed sheets is deferred.

## Calculation contract

Expressions operate only on supported operators, typed literals, declared fields, and explicitly named shared definitions. No `eval`, dynamic code execution, filesystem access, network access, or arbitrary function calls are permitted.

The engine validates dependencies, detects cycles and missing references, and evaluates derived values in dependency order. Invalid inputs and calculation errors produce actionable diagnostics rather than silently becoming zero. Exact operators, numeric behavior, rounding, and lookup semantics must be specified and verified against the supplied rulebook before implementation.

Users choose career/class, skills, talents, traits and custom entries using the rulebook and GM judgment; the application does not enforce complete character legality or prerequisites. Descriptions are informational. Only explicit supported effects on template-declared targets affect calculations. The initial bounded effect is a positive-integer multiplication of a derived value after its base formula; conflicting effects on one target are rejected rather than silently stacked. This supports Unnatural Strength/Toughness independently of species or instance role.

Persist editable source values and chosen entries/effects. Derived values are recomputed when an instance loads or changes; they are not authoritative saved state. Derived-value overrides are outside the first milestone unless explicitly added by a phase specification.

## Saved entity contract

Each instance records a stable ID, entity type, instance role, system ID, template ID and version, file schema version, display name, editable values, and creation/modification timestamps in UTC ISO 8601 format. Templates and shared rules have explicit versions separate from the storage schema version.

Characters and monsters use the same creature template and generic instance model; role distinguishes library placement and workflow without changing calculations. The instance owns optional career/class text and selected entries, including explicitly supported mechanical effects. Future ships and planetary systems can use distinct descriptive templates; their storage/workflow contracts remain deferred. Every newly created instance receives its own ID. Future encounter copies must be independent instances with provenance rather than shared mutable library records.

Loading validates data and resolves the exact template and rule dependencies. Unsupported versions or missing dependencies must be reported without rewriting the source file. Automatic migration and template upgrades require a separately specified policy.

## Local library layout

The user selects the library base directory. The initial layout is:

```text
<library>/
  RPG_systems/
    <system-id>/
      system.json
      templates/
      rules/           # Optional shared definitions
      characters/
      monsters/
```

Use stable IDs for entity filenames. Versioned definition storage and reference resolution will be detailed in the data-contract phase so saved instances remain reproducible as templates evolve. Add NPCs, equipment, and campaigns when their phases are specified. Use `monsters` consistently instead of the brainstorming document's `beastiery` spelling.

Keep application source, specifications, and the user's runtime library separate. Phase specifications live in `specs/<date_phase_name>`; runtime system definitions are JSON documents, not Markdown phase specifications.

## Persistence and verification

Validate before saving. Write through a temporary file and use a safe replacement strategy; retain the previous valid revision as a rollback backup when overwriting. Specify failure recovery and backup location before persistence implementation. Modification timestamps aid comparison but do not by themselves resolve import conflicts.

Use Vitest for focused unit tests covering rules, schema validation, dependency errors, and persistence failure handling. Use Playwright for end-to-end tests of the Electron application's complete create/edit/save/reload workflow. Complement automated coverage with manual verification against phase acceptance criteria. Rule examples must be traceable to the supplied rulebook, including page references and any explicitly accepted interpretations.

The Python tooling under data_contracts/verification is a contract/fixture verifier, not a production rules engine. Keep its arithmetic tracing bounded to the specified fixtures. Future TypeScript acceptance tests must use the same independent input/output and invalid-data cases; reuse language-neutral fixtures and retire overlapping Python tracing rather than maintaining two production implementations.
