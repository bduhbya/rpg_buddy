# Phase 7: Definition structure validation - Requirements

## 1. Context

Phase 6 provides domain declarations and Vitest fixtures but no runtime validation. Authority: `../mission.md`, `../tech-stack.md`, `../roadmap.md`, `../../data_contracts/contracts.md` and the v1 system/template schemas. The user accepted the proposed scope on 2026-11-02.

## 2. Scope

- DS-1: Validate unknown parsed system manifests and templates against closed v1 shapes and document-local invariants.
- DS-2: Return typed success or nonempty actionable diagnostics, with caller-supplied logical document identity and RFC 6901 pointers; never mutate input or expose partially valid data as success.
- DS-3: Verify behavior and framework independence using the established harness.

Exclude JSON parsing/duplicate JSON keys, cross-document resolution, expression reference/type/cycle analysis, evaluation, instances, filesystem, UI, feature catalogs and new game rules. Structural success does not prove that a definition resolves or calculates correctly.

## 3. Product decisions

Reject unknown properties, unsupported schema versions, malformed identifiers/versions, blank required text and unsafe numbers without coercion or migration. Allow repeated template IDs at different versions but reject repeated exact pairs. Preserve declared order, original values and optional documentary metadata. Error ordering and exhaustive cascades are not API guarantees. Missing schemaVersion is a structure error; a present version other than numeric 1 is unsupported.

## 4. Technical requirements

Accept parsed JSON-compatible values through `unknown`, plus a logical document string. A result is either `{ success: true, value }` or `{ success: false, diagnostics }`; failure has no value. Success returns the validated input object, not a clone; callers must revalidate after mutation. Validators are synchronous and pure, with no infrastructure imports or logging side effects.

Match required/optional properties, array minima, patterns and constants in both schemas. Enforce normative finite/safe-integer constraints, local duplicate IDs, input minimum/default/maximum consistency, exactly one section membership per field and unique modifier targets restricted to derived IDs. Expression shape checks cover all seven closed operations and nested numeric literals, without evaluating or checking operand/result types, referenced fields or dependency cycles. No shared-rule node exists in v1.

Use existing diagnostic codes and precise escaped pointers; duplicate diagnostics may include related locations. Messages explain the expected shape/constraint without dumping source contents. Arbitrary hostile JavaScript objects with getters/proxies or cyclic graphs are outside the parsed-JSON boundary.

## 5. Accessibility requirements

No interface changes; keyboard/focus/screen-reader checks are not applicable. Preserve labels, ordering, citations and metadata. Diagnostic messages and pointers must support understandable downstream feedback without relying on color or presentation.

## 6. Completion requirements

- DS-1: Both authored definitions pass; malformed shapes and local invariants fail; deferred semantic work is not claimed as validated.
- DS-2: Tests prove failure discrimination, nested/escaped locations, no coercion and input preservation.
- DS-3: Vitest, strict TypeScript, domain boundary checks, Python contract verification, formatting and diff checks pass. Exactly three documents in this folder. Human walkthrough is supplementary. Packaging and Electron smoke tests are unnecessary unless build/runtime integration changes.
