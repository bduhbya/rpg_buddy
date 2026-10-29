# Rogue Trader: supported milestone slice

Status: complete. Source review and agent verification finished; concrete scope approved by the user on 2026-10-28. This is the Phase 1 deliverable, not a runtime template or a complete playable sheet.

## Source identity and reproduction

User-supplied source: `C:\Users\Bduhbya\Downloads\Rogue Trader - Core Rulebook.pdf`.

- Title: Rogue Trader, core roleplaying rulebook, Fantasy Flight Games.
- Credits: copyright Games Workshop Limited 2009; ISBN `978-1-58994-675-0`; product code `RT01`; Print ID `01`; printed in the USA.
- Source designation for this project: **2009 core rulebook, RT01, Print ID 01**. This is the original FFG roleplaying core book, not the older tabletop title. No explicit numbered edition statement was observed on title/credits; do not fabricate one in metadata.
- 408 PDF pages; 245,792,104 bytes.
- SHA-256: `AEC28EE72BBE059AD789BF94631BB74CCD2945642620C246DD2D546FA9E52835`.
- Image-only scan: pypdf returned empty text for all 408 pages. Relevant pages were rendered with Poppler and read visually; no OCR text was treated as authoritative.
- For the cited pages, one-based PDF page = printed page + 4. Enter the PDF number in the viewer page control; printed numbers appear in the page footer.
- No external rules, errata, supplements or later revisions are included. The scan creation timestamp is not used to infer publication edition.

| Reference | Printed page | PDF page | Heading and use                                                                                     |
| --------- | ------------ | -------- | --------------------------------------------------------------------------------------------------- |
| S1        | 1-2          | 5-6      | Title and Credits: publication identity                                                             |
| S2        | 14           | 18       | Stage 1: Generate Characteristics; Characteristic Bonuses; worked character example                 |
| S3        | 31           | 35       | Name: freely selected character identity                                                            |
| S4        | 264-265      | 268-269  | Movement; Table 9-30, Structured Time Movement (metres/round)                                       |
| S5        | 367          | 371      | Size and Table 14-2: boundary of excluded movement modifiers                                        |
| S6        | 368          | 372      | Unnatural Characteristic: multiply the bonus, not the score; no movement modification by this trait |
| S7        | 377          | 381      | Ork Freebooter Profile: characteristics, Movement, Unnatural Toughness (x2)                         |

To reproduce visual inspection, use a locally available Poppler installation, for example:

```powershell
pdftoppm -f 18 -l 18 -scale-to 1800 -singlefile -png 'C:\Users\Bduhbya\Downloads\Rogue Trader - Core Rulebook.pdf' '<existing-scratch-directory>\characteristics'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\Bduhbya\Downloads\Rogue Trader - Core Rulebook.pdf'
```

Repeat rendering for each PDF page in the register. The book and rendered pages remain outside Git. References identify source facts; the policies below are approved application decisions, not claims that the book imposes application limits.

## Selected templates and identity

Two distinct entity kinds use the same field/calculation model:

| Selected template                | Entity kind | Identity and purpose                                                                                                  |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Explorator - core statistics     | character   | User-selected `displayName`; manual entry of final characteristics; ordinary, unmodified bonuses and movement         |
| Ork Freebooter - core statistics | monster     | User-selected `displayName`; manually editable profile characteristics; fixed Unnatural Toughness x2 in this template |

`displayName` is a required nonblank string for both kinds (application policy); duplicate display names are allowed because stable instance IDs identify records. `kind` is fixed by the template, not an editable rules field. The character name basis is S3; the monster profile label is S7. Stable system/template/instance IDs, versions and timestamps are application metadata required by the constitution, to be specified in Phase 2; they are not RPG mechanics.

The Explorator template does not choose a career or apply an Origin Path. Users supply final values after any external creation/advancement decisions. The monster template represents only the selected portion of the Ork profile. Its title must retain the scope qualification so it is not presented as a complete stat block.

## Editable field inventory

Both kinds expose precisely the following nine editable numeric fields, in this order. Identifiers are semantic handoff names; Phase 2 will define their JSON representation. All definitions come from S2; their use in the selected monster profile is verified in S7.

| Identifier     | Label           | Book abbreviation | Source |
| -------------- | --------------- | ----------------- | ------ |
| weaponSkill    | Weapon Skill    | WS                | S2, S7 |
| ballisticSkill | Ballistic Skill | BS                | S2, S7 |
| strength       | Strength        | S                 | S2, S7 |
| toughness      | Toughness       | T                 | S2, S7 |
| agility        | Agility         | Ag                | S2, S7 |
| intelligence   | Intelligence    | Int               | S2, S7 |
| perception     | Perception      | Per               | S2, S7 |
| willpower      | Willpower       | WP                | S2, S7 |
| fellowship     | Fellowship      | Fel               | S2, S7 |

Approved application input contract: finite integers from 0 through 99 inclusive. S2 describes a 0-100 scale, but this slice deliberately excludes score 100 and above to avoid extending the printed tens-digit language at three digits. This is a coverage limit, not a statement that 100 is illegal in the game. Revisit it explicitly when broadening coverage.

Manual entry only. Character creation rolls, rerolls and the optional point-allocation method described on S2 are not implemented. A freshly created instance may use the worked values below as clearly labeled demonstration defaults; they are not universal starting scores or generated legal characters. Approved defaults: character example C1 and monster example M1. The initial display names are `Example Explorator` and `Example Ork Freebooter`, editable by the user. No die roll is implicit.

## Derived field inventory and dependencies

Exactly seven visible derived values are selected. They are read-only and recomputed after valid edits or reload; do not persist them as authoritative source values.

| Identifier     | Label           | Explorator            | Ork Freebooter            | Dependencies and source |
| -------------- | --------------- | --------------------- | ------------------------- | ----------------------- |
| strengthBonus  | Strength Bonus  | floor(strength / 10)  | same                      | strength; S2            |
| toughnessBonus | Toughness Bonus | floor(toughness / 10) | 2 * floor(toughness / 10) | toughness; S2, S6, S7   |
| agilityBonus   | Agility Bonus   | floor(agility / 10)   | same                      | agility; S2             |
| halfMove       | Half Move       | movement rule below   | same                      | agilityBonus; S4        |
| fullMove       | Full Move       | movement rule below   | same                      | agilityBonus; S4        |
| chargeMove     | Charge          | movement rule below   | same                      | agilityBonus; S4        |
| runMove        | Run             | movement rule below   | same                      | agilityBonus; S4        |

Bonuses are dimensionless. Movement values are metres per combat round, on ordinary terrain with no movement modifiers. `floor` means round down after division, before multiplying a bonus. For the admitted input range it expresses the book's tens digit precisely.

Let `a = agilityBonus`. For a = 1 through 9, movement is `(a, 2*a, 3*a, 6*a)` in Half/Full/Charge/Run order. For a = 0, use the explicit Table 9-30 row `(0.5, 1, 2, 3)`. Do not extrapolate the regular formula to zero. Preserve 0.5 exactly; do not round movement to integers. Table 9-30 also lists AB 10, but the proposed input range does not reach that row.

The only trait calculation in scope is the Ork template's fixed Toughness Bonus multiplier of 2 (S6/S7). There is no editable multiplier or trait toggle and no generic trait subsystem. Do not double the Toughness characteristic itself. Do not infer damage reduction, opposed-test success changes, or extra rule behavior from displaying TB.

Dependency order is core inputs -> bonuses -> movement. Name and the other six characteristics do not affect the selected derived values. Missing inputs must be diagnosed rather than defaulted to zero. Future engine phases must reject missing references and cycles; these examples intentionally contain neither.

### Movement interpretation boundary

S4 explicitly allows traits to modify movement. S5 describes size modifiers and a base-movement minimum, while S6 distinguishes Unnatural Characteristic from movement modifiers. This phase selects only the unmodified Table 9-30 movement profile, including its explicit zero row. It does not reconcile or implement size-adjusted zero-AB movement, encumbrance, injury, talents, terrain, flight or other special cases. The Ork profile's printed movement agrees with the selected unmodified row. Do not apply a blanket minimum of 1 to Half Move: that would erase the selected table's 0.5 value. Broader modifier interactions need a later source-reviewed phase.

## Worked examples

All rows use the field order WS, BS, S, T, Ag, Int, Per, WP, Fel. These are calculation fixtures, not complete characters or complete bestiary entries.

### C1: Character example from S2

Inputs: `(36, 33, 41, 35, 34, 37, 40, 39, 33)`.

- Strength Bonus: floor(41/10) = 4, agreeing with the printed example.
- Toughness Bonus: floor(35/10) = 3, agreeing with the printed example.
- Agility Bonus: floor(34/10) = 3, agreeing with the printed example.
- Half/Full/Charge/Run = `(3, 6, 9, 18)` metres/round, matching Table 9-30 AB 3 (S4).

The other six inputs are preserved as editable source values without selected derived outputs. The full vector matches the S2 worked table. No claim is made about a finished Origin Path or legal equipment/career selection.

### M1: Monster profile from S7

Inputs: `(45, 20, 50, 45, 30, 26, 30, 28, 22)`.

- Strength Bonus: floor(50/10) = 5.
- Toughness Bonus: 2 * floor(45/10) = 2 * 4 = 8. The profile prints the modified 8 and specifies Unnatural Toughness (x2); S6 explains the multiplication.
- Agility Bonus: floor(30/10) = 3.
- Half/Full/Charge/Run = `(3, 6, 9, 18)`, agreeing with the profile's movement line and S4.

Wounds 16, armour, weapons, skills, talents, other traits and Mob Rule appear in the source profile but are excluded from this slice. In particular, WP 28 is the entered base value; no conditional Mob Rule bonus is applied. This is not a combat automation or damage calculation example.

### C2: Dependent edit and instance independence

Start with C1. Edit only Agility 34 -> 40. AB changes 3 -> 4 and movement becomes `(4, 8, 12, 24)` (S2/S4). SB stays 4; TB stays 3. Editing a second C1 instance instead must leave the first instance and the template unchanged. Independence is an application requirement for later phases, not behavior claimed to be executable now.

### M2: Trait multiplication order

Start with M1. Edit only Toughness 45 -> 50. TB becomes `2 * floor(50/10) = 10`; Toughness stays 50 and movement remains `(3, 6, 9, 18)`. At T 49 TB is still 8: `floor(2*49/10) = 9` would be incorrect. This case distinguishes multiplication of the bonus from multiplication of the characteristic (S6).

### B1: Numeric boundaries (constructed from S2/S4)

| Edited input | Expected base bonus | Expected movement when input is Agility |
| ------------ | ------------------- | --------------------------------------- |
| 0            | 0                   | (0.5, 1, 2, 3)                          |
| 9            | 0                   | (0.5, 1, 2, 3)                          |
| 10           | 1                   | (1, 2, 3, 6)                            |
| 39           | 3                   | (3, 6, 9, 18)                           |
| 40           | 4                   | (4, 8, 12, 24)                          |
| 99           | 9                   | (9, 18, 27, 54)                         |

For the Ork's Toughness only, multiply the base bonus column by 2. These boundary vectors are constructed verification cases, not quotations of book examples.

### N1: Approved invalid-input feedback

Reject missing/null values, numeric strings in stored data, fractions such as 34.5, negatives, 100+, booleans and non-finite numbers. Reject blank display names. Later UI editing may parse user-entered numeric text, but must not silently coerce an empty field to zero. Preserve the last valid instance and show field-specific feedback; do not recalculate or save an invalid replacement. Phase 2 must define diagnostic/data contracts; the engine and editor phases must test them. These are approved application policies, not rules quoted from the book.

## Exclusions and handoff

Excluded from the milestone slice: full character generation/legality, careers, Origin Paths, advances/XP, skills and tests, talents, all other trait automation, Wounds and damage/healing, armour, weapons, equipment, encumbrance, Fate, psychic/Navigator powers, corruption/insanity, temporary modifiers, alternate movement and terrain, initiative, dice rolling, campaigns and encounters, sharing and conflict resolution, and visual reproduction of printed sheets. Arbitrary monsters with absent/dashed statistics or special movement are not covered by the Ork template.

Phase 2 must encode these semantics in versioned manifests/templates/instances and a restricted declarative expression subset. Required capabilities are numeric field references, constants, division, floor, multiplication and an explicit zero-AB branch or equivalent finite lookup. This is a capability list, not settled expression syntax or a tooling choice. Keep formulas in templates unless actual reuse justifies shared definitions; no hard-coded Ork rules in generic application code. Follow the constitution's identity, version, persistence and IPC boundaries.

Later phase acceptance must include C1, M1, C2, M2, B1 and N1, plus generic missing-reference/cycle validation and character/monster save/reload independence when those features exist. This source review does not claim those application tests have run.

## Approval record

On 2026-10-28 the user approved the specific scope, including templates, input limits, defaults, seven derived values, examples and exclusions, with the naming correction: "Explorer should be Explorator. The scope is approved". Applied Explorator consistently to the character template and demonstration name. This naming decision does not add career selection, career abilities, implants or other career mechanics; those remain excluded. Phase 1 is complete.
