import type { Template } from './documents';
import type { LocatedDefinition } from './in-memory-definition-catalog';
import { calculateDerived } from './calculation-engine';
import type { ValidationResult } from './validation';

/**
 * Recompute derived results with validated instance-owned entry snapshots.
 * Entry diagnostics are relative to the supplied array's logical document root.
 * Failure exposes no partial results; callers retain their previous valid state.
 */
export function calculateWithEntries(
  template: LocatedDefinition<Template>,
  sourceValues: LocatedDefinition<unknown>,
  entries: LocatedDefinition<unknown>,
): ValidationResult<Record<string, number>> {
  return calculateDerived(template, sourceValues, entries);
}
