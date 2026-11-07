import type { Template } from '../definitions/document-models';
import type { LocatedDefinition } from '../definition-processing/in-memory-definition-catalog';
import { calculateDerived } from './calculation-engine';
import type { ValidationResult } from '../instances/structural-validation';

/**
 * Compute derived values from a template and its editable inputs using base formulas.
 * @param template Located template that defines the input fields and formulas.
 * @param sourceValues Located input map containing a value for every declared input.
 * @returns Derived values keyed by field ID, or diagnostics without partial values.
 */
export function calculateBase(
  template: LocatedDefinition<Template>,
  sourceValues: LocatedDefinition<unknown>,
): ValidationResult<Record<string, number>> {
  return calculateDerived(template, sourceValues);
}
