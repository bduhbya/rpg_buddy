# Phase 1: Source review and scope - Validation

## Required activities (defined before deliverable authoring)

| ID | Requirements | Method and expected result | Status |
| --- | --- | --- | --- |
| V1 | SR-1 | Inspect rendered title/credits; fingerprint PDF; match printed/PDF numbering on every cited rule page. Expect unambiguous source identity and locations. | Passed |
| V2 | SR-2, SR-3 | Inspect full relevant rule pages and compare each selected field/formula with the source; check exceptions and explicit exclusions. Expect no unsupported rule claims. | Passed |
| V3 | SR-4 | Independently calculate example bonuses, movement and edit/boundary results; compare with book examples/tables. Expect exact agreement and no silent invalid-input coercion. | Passed |
| V4 | SR-3, SR-5 | Inspect all phase documents, links and git diff; run git diff --check. Expect coherent scope, no application code or PDF committed, no constitution conflict. | Passed |
| V5 | SR-6 | Human opens the supplied PDF and source-review.md, follows the checklist below, and explicitly accepts or corrects the selected slice. Expect recorded approval before Phase 1 completion. | Passed |

## Human walkthrough

Preconditions: local source PDF available, source-review.md present, no application required.

1. Compare credits with the recorded publication metadata.
2. Visit each printed/PDF page pair in the source register.
3. Review character and monster fields, formulas, numeric boundaries and exclusions.
4. Recalculate character and monster examples and the edit/boundary cases using the cited pages.
5. Confirm the proposed scope is sufficient for the first milestone; accept it or identify changes.

## Results recorded 2026-10-28

- V1 Passed: visually inspected PDF pages 5-6 (title/credits) and every cited rules page: 18, 35, 268-269, 371-372, 381. Printed footer numbers agree with the +4 mapping. Credits establish 2009, RT01, Print ID 01, ISBN 978-1-58994-675-0. Get-FileHash returned the fingerprint recorded in source-review.md. The PDF has 408 pages and no extractable page text. Full relevant pages were reviewed, including table headings and exception text.
- V2 Passed: nine characteristic inputs verified against printed p.14 and Ork p.377. The three selected bonuses trace to p.14; Ork TB multiplication traces to pp.368/377. Movement agrees with Table 9-30, including AB 0. Size and Unnatural Characteristic movement exceptions were inspected on pp.367-368 and explicitly bounded rather than generalized. Name and identity policies are distinguished from source facts. Wounds and other profile mechanics are explicitly excluded.
- V3 Passed: independent scratch Python arithmetic checks passed 11 vectors: C1, M1, C2, M2 at T50 and T49, plus B1 at 0, 9, 10, 39, 40 and 99. Expected movement rows were visually compared with Table 9-30; character values with p.14; Ork TB8 and movement with p.377. N1 was checked for specification coverage only; no validator exists and no runtime rejection is claimed. Reproduce the arithmetic manually from the formulas and vectors in source-review.md; the scratch checker is outside the repository and is not production code.
- V4 Passed: all four Markdown documents inspected for requirement coverage, relative constitution links, task/result consistency and bounded handoff. git diff --check passed; untracked phase documents were additionally checked using git diff --no-index --check against NUL. Changes are limited to the new phase folder and the Phase 1 completion marker in the roadmap; no book images, PDF, application code or runtime library were added. No constitution decisions changed.
- V5 Passed: on 2026-10-28 the user explicitly approved the concrete scope, with the correction "Explorer should be Explorator. The scope is approved". The correction is applied throughout the source review, including its demonstration default name. P6 and the roadmap Phase 1 marker are complete. This records the user's scope review and acceptance; it does not claim the user independently executed every optional walkthrough calculation.
- Final inspection Passed: checked the naming correction, approval records, completion markers, and whitespace after the documentation update. All Phase 1 completion requirements are met.

Application unit/E2E tests are not applicable to this documentation-only phase. Future runtime validation, persistence/recovery and interface checks remain obligations of their respective phases, not passed checks here.
