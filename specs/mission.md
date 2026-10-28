# Mission

## Purpose

Build an approachable RPG companion for players and game masters that provides editable electronic character sheets, reliable rule calculations, and portable local data. The architecture must support multiple RPG systems through data-defined templates without requiring a separate application for each system.

This constitution consists of `mission.md`, `tech-stack.md`, and `roadmap.md`. These documents guide phase specifications and implementation. Changes to these decisions must be explicit and reflected in the affected specifications.

## First functional milestone

Support the base game of **Warhammer 40,000: Rogue Trader**. The user will provide the source rulebook PDF after this constitution is complete. Confirm the edition and relevant rules from that source before specifying system content; do not invent or assume mechanics.

The milestone is complete when a user can:

- Load a Rogue Trader character or monster template.
- Create distinct character and monster instances from those templates.
- Edit template-defined core values through a usable interface.
- See supported derived values update according to template-defined relationships.
- Save instances to the configured local library and reload them without losing their values or identity.
- Receive clear feedback for invalid input, unsupported template versions, missing dependencies, or calculation failures.

The milestone proves a representative, explicitly specified subset of the base game's sheet data and calculations. It does not promise complete character-generation automation or every rule in the book. The source-review phase defines the exact supported fields, calculations, and examples for human approval.

## Product principles

- Keep player and game master functionality built on shared domain logic and reusable interface components.
- Keep rules and saved data understandable, versioned, and portable.
- Make calculated values traceable to their inputs and rule definitions.
- Preserve user data when validation, calculation, or saving fails.
- Keep system-specific mechanics out of generic application code wherever the declarative model can reasonably express them.
- Prefer a small, verifiable working slice over broad unfinished functionality.

## Future scope

Later milestones may add NPC libraries, campaigns, encounter participants, initiative tracking, virtual dice, equipment and consumable effects, temporary effects, visual sheet customization, and sharing/import conflict handling. These remain part of the product vision but are outside the first functional milestone.

## Spec-driven development

Before implementing each phase, create a phase specification under `specs/<date_phase_name>/`. Each specification defines scope, expected behavior, data contracts, acceptance criteria, verification steps, and exclusions. Resolve material uncertainties with the user before implementing dependent behavior.

Keep phases small enough for a human to inspect and verify. Record verification results and any accepted deviations with the phase specification. Update the constitution when a phase would change a constitutional decision; do not silently diverge from it.
