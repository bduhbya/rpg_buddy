# Phase 1: Source review and scope - Requirements

## 1. Context

The first milestone must prove a representative subset of the supplied Rogue Trader base game for characters and monsters. `../mission.md`, `../tech-stack.md`, and `../roadmap.md` govern this phase. The user supplied `C:\Users\Bduhbya\Downloads\Rogue Trader - Core Rulebook.pdf` and accepted the proposed small source-review phase on 2026-10-28. Confirm the publication from the book itself rather than assuming an edition from the filename.

## 2. Scope

SR-1: Identify the supplied publication and exact reviewed pages.
SR-2: Specify representative editable identity and nine core characteristic fields for both entity kinds, with a small set of derived statistics.
SR-3: Distinguish rule facts from proposed application policies; explicitly exclude unsupported mechanics.
SR-4: Provide traceable worked examples for both kinds, dependency chains, boundary cases, and expected invalid-input behavior.

Application code, runtime JSON contracts, full character generation, and complete bestiary transcription are excluded. Phase 2 consumes the agreed source-review result.

## 3. Product decisions

Settled: manually entered values; character and monster coverage; small source-supported slice; no application code this phase. The user approved the concrete field selection and interpretations on 2026-10-28 under SR-6, requesting the character-template name Explorator. This naming correction does not add career mechanics. See source-review.md for the approval record.

## 4. Technical requirements

The source-review deliverable will live in `source-review.md`. It must record publication metadata, printed and PDF page numbers, selected field identifiers and semantic types, source references, supported calculations and their dependencies, numeric behavior, exclusions, and examples. Product constraints must not be presented as book rules. Preserve architecture decisions: data-defined system rules, explicit versions, no executable formulas, and recomputation of derived values.

## 5. Accessibility requirements

No interface changes occur in this phase. Use descriptive headings, textual formulas, labeled tables and units so the scope can be reviewed without relying on color or page images. Downstream editors must expose field labels, keyboard operation, derived/read-only distinction, and understandable validation feedback; detailed interface acceptance belongs to its phase.

## 6. Completion requirements

- SR-1: Publication identified with verifiable source locations and fingerprint.
- SR-2: Character and monster editable/derived field inventory complete and bounded.
- SR-3: Every selected rule cited; policies, uncertainties and exclusions explicit.
- SR-4: Examples and numeric boundaries checked, including a dependent-value edit and invalid cases.
- SR-5: Source inspection, arithmetic checks and document consistency recorded in validation.md; human review is reproducible.
- SR-6: Human approves the concrete supported-field list, examples and exclusions. Until then, leave the roadmap checkbox open and do not claim Phase 1 complete.
