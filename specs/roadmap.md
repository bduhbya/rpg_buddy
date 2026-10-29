# Roadmap

## Working method

Implement one small phase at a time. Before coding, write its specification in `specs/<date_phase_name>/`, with scope, acceptance criteria, and a short human verification procedure. Detailed tasks and implementation choices belong in those phase specifications. Record completion evidence there before moving on.

The sequence below is the initial plan. Amend it explicitly as source review or implementation reveals new requirements.

## First functional milestone

| Completed | Phase | Deliverable                                                                                                            | Human-verifiable completion                                                                            |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [x] | 1. Source review and scope | Confirm the supplied Rogue Trader book and select representative character and monster fields and calculations.        | Review the supported-field list, source references, worked examples, and exclusions.                   |
| [x] | 2. Data contracts          | Specify system manifests, templates, instances, versions, expressions, and library paths; provide small JSON examples. | Inspect one character and one monster example and trace every dependency.                              |
| [ ] | 3. Application foundation  | Establish Electron, React, TypeScript, and the domain/persistence/UI boundaries.                                       | Launch a minimal desktop window and verify the typed application boundary.                             |
| [ ] | 4. Definition validation   | Load and validate the system manifest and templates without a full editor.                                             | Valid examples load; malformed definitions produce understandable diagnostics.                         |
| [ ] | 5. Calculation engine      | Evaluate the agreed expression subset and dependency graph.                                                            | Compare outputs with worked rule examples; verify missing references and cycles are rejected.          |
| [ ] | 6. Rogue Trader templates  | Encode the shared creature template and instance-owned character/monster features using the validated contracts.                                           | Review field definitions and calculation results against the source book.                              |
| [ ] | 7. In-memory instances     | Create independent instances, apply defaults, edit values, and recompute results.                                      | Demonstrate that editing one instance updates its results without changing another.                    |
| [ ] | 8. Save and reload         | Add configurable library location, validated JSON persistence, and overwrite backups.                                  | Round-trip character and monster instances; demonstrate backup preservation and safe failure handling. |
| [ ] | 9. Minimal sheet editor    | Connect template selection, instance creation, editable fields, derived values, and save/load controls.                | Complete the workflow through the interface for both instance roles.                                     |
| [ ] | 10. Milestone verification | Run the agreed acceptance scenarios and address blocking defects.                                                      | A human reproduces create, edit, calculate, save, close, and reload for a character and a monster.     |

Use fixtures or a small development harness to inspect domain behavior before the sheet editor exists. The foundation window provides an early runnable application; later phases add verified behavior incrementally.

## Feature-library follow-on commitment

Before implementing reusable feature selection, specify a bounded phase for system-specific feature definitions/catalog storage, exact version provenance, compatibility checks and copying selections into instance-owned entries. Templates retain generic modifierTargets and do not enumerate named features. Selected snapshots remain usable without a live library; upgrades require explicit user action. The current Phase 2 entry/effect contract is the snapshot baseline, not an implemented library. Schedule the follow-on explicitly when selecting the next scope; it is not implicitly added to the foundation phase.

## Later milestones

Specify these only after the first milestone is verified:

1. Broaden base-game sheet coverage and add NPC/library browsing workflows.
2. Add campaigns, membership, and independent campaign instances.
3. Add encounters, participant selection, initiative, and turn tracking.
4. Add optional dice rolling.
5. Add equipment, consumables, and temporary effects in separately verifiable phases.
6. Add richer sheet presentation and prove a second RPG system.
7. Add export/import, conflict resolution, and user-facing rollback workflows.

Later ordering is provisional. Expand each milestone into similarly small phases before implementation.
