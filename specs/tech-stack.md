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

## System definitions and templates

A system manifest identifies the RPG system, edition/source metadata, and available templates and shared rules. Stable identifiers connect these documents; filenames and display names are not entity identity.

Character and monster templates define fields, types, defaults, constraints, grouping, and derived-statistic relationships. Keep formulas close to the fields they derive so a sheet's statistical model is readable in its template.

Separate rules documents are reserved for reusable mechanics shared across templates, such as common lookup tables or named calculations. Templates may reference those definitions through explicit, versioned dependencies. Do not duplicate a formula in both places or introduce a shared-rules abstraction before a concrete need is identified.

Presentation metadata describes semantic sections and ordering initially. Full visual replication of printed sheets is deferred.

## Calculation contract

Expressions operate only on supported operators, typed literals, declared fields, and explicitly named shared definitions. No `eval`, dynamic code execution, filesystem access, network access, or arbitrary function calls are permitted.

The engine validates dependencies, detects cycles and missing references, and evaluates derived values in dependency order. Invalid inputs and calculation errors produce actionable diagnostics rather than silently becoming zero. Exact operators, numeric behavior, rounding, and lookup semantics must be specified and verified against the supplied rulebook before implementation.

Persist editable source values. Derived values are recomputed when an instance loads or changes; they are not authoritative saved state. Derived-value overrides are outside the first milestone unless explicitly added by a phase specification.

## Saved entity contract

Each instance records a stable ID, entity kind, system ID, template ID and version, file schema version, display name, editable values, and creation/modification timestamps in UTC ISO 8601 format. Templates and shared rules have explicit versions separate from the storage schema version.

Characters and monsters are distinct entity kinds using the same generic instance model. Every newly created instance receives its own ID. Future encounter copies must be independent instances with provenance rather than shared mutable library records.

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
