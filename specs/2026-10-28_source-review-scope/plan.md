# Phase 1: Source review and scope - Plan

## Branch and starting point

- Topic branch: `phase/2026-10-28-source-review-scope` (verified checked out before writing this specification).
- Starting base: `main`, commit `6decba20f6844fae7ced6b21fc99b67f7393dd6f`.
- Initial working tree: clean. No application code exists.
- Date: 2026-10-28 (user local date).

## Confirmed execution preferences

The user accepted source identification, selection of a small character/monster slice, then page references, worked examples, and exclusions. No application code in this phase. The user supplied the local core rulebook PDF, reported a 2009 printing, and accepted source checks and a reproducible human review checklist. Edition identification is part of the source inspection.

## Tasks in dependency order

- [x] P1: Inspect constitution, roadmap, repository and branch state; obtain grouped plan/requirements/validation answers. Outcome: authorized scope and dedicated topic branch established (SR-1).
- [x] P2: Identify supplied source and page mapping. Outcome: publication identifiers, fingerprint, and reproducible source locations recorded (SR-1).
- [x] P3: Select bounded character and monster fields and calculations. Outcome: source-referenced field list, exclusions, numeric boundaries, and downstream handoff recorded (SR-2, SR-3).
- [x] P4: Write and check worked examples and negative cases. Outcome: every selected dependency can be traced, with independently checked expected results (SR-4).
- [x] P5: Inspect documentation and constitution consistency; provide human review procedure. Outcome: verification evidence recorded with honest statuses (SR-5).
- [x] P6: Obtain human approval of the concrete supported fields, examples, and exclusions. Outcome: approval recorded and roadmap Phase 1 checked (SR-6).

## Dependencies and limits

The local PDF is required to verify rules; it is not copied into the repository. This phase delivers source-review documentation. Phase 2 owns JSON schemas, expression syntax and sample documents. Later phases own application code, automated engine tests, templates, and persistence. Do not start those phases here.

## Status

Phase 1 complete. Source review, agent checks and user scope approval (P6 / V5) are recorded. The user requested Explorator as the character-template name; that correction is applied without expanding rules coverage. The roadmap marks Phase 1 complete. No application code was added and no constitution decisions changed.
