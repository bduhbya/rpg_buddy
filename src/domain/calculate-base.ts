import type { Template } from './documents';
import type { LocatedDefinition } from './in-memory-definition-catalog';
import { calculateDerived } from './calculation-engine';
import type { ValidationResult } from './validation';

/** Calculate base-only derived values; instance effects are deliberately excluded. */
export function calculateBase(
  template: LocatedDefinition<Template>,
  sourceValues: LocatedDefinition<unknown>,
): ValidationResult<Record<string, number>> {
  return calculateDerived(template, sourceValues);
}
