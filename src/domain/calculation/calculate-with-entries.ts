import type { Template } from '../documents';
import type { LocatedDefinition } from '../definition-processing/in-memory-definition-catalog';
import { calculateDerived } from './calculation-engine';
import type { ValidationResult } from '../validation';

/**
 * Compute derived values with the effects declared by an instance's entry snapshots.
 * @param template Located template that defines the formulas and allowed effect targets.
 * @param sourceValues Located input map containing a value for every declared input.
 * @param entries Located entry array. Entry diagnostic pointers are relative to the array root.
 * @returns Derived values keyed by field ID, or diagnostics without partial values.
 */
export function calculateWithEntries(
  template: LocatedDefinition<Template>,
  sourceValues: LocatedDefinition<unknown>,
  entries: LocatedDefinition<unknown>,
): ValidationResult<Record<string, number>> {
  return calculateDerived(template, sourceValues, entries);
}
