# Requirements

## Context

Phase 8 resolves exact definitions. Phase 9 applies the [v1 calculation contract](../../data_contracts/contracts.md) to a resolved template and supplied source values.

## Scope

Implement framework-independent base calculations. Instance-entry effects, persistence, and UI integration are deferred.

## Product decisions

Use the existing v1 operators and numeric behavior. Reject invalid calculations with actionable diagnostics and return no partial results.

## Technical requirements

- BC-1. Discover references throughout each expression, including both conditional branches. Reject unknown fields and cycles with template document locations. Order derived fields after their derived dependencies.
- BC-2. Validate all supplied inputs and expression operand types before evaluation. Use lazy conditional evaluation, reject division by signed zero and invalid numbers, normalize negative zero, and preserve the v1 rounding rules.

## Accessibility requirements

The phase introduces no interface. Diagnostics provide messages and document locations for downstream presentation.

## Completion requirements

- BC-3. Pass graph and evaluation checks, match both independent worked examples, and document a reproducible walkthrough.

## API acceptance details

BC-2 uses `calculateBase(template, sourceValues)`, with located inputs and derived-only outputs. Revalidate mutable template copies at this boundary. Validate exact own input keys, safe integer values and inclusive bounds before evaluating any expression. Diagnostic locations identify the template expression or the supplied value-map key. Every invocation recomputes independently, preserves caller data and exposes no partial results on failure. Unsupported operations fail structural validation.

BC-3 compares base expectations independently of instance effects. The Ork base TB is 4 at T45/T49 and 5 at T50. Effect-adjusted TB8/TB10 remains Phase 10 acceptance.
