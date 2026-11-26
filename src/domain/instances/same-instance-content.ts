import type { Instance } from '../definitions/document-models';
import { sameJsonContent } from '../definitions/json-content';

/**
 * Compare complete sheet content while ignoring the last modification timestamp.
 * @param left First validated sheet.
 * @param right Second validated sheet.
 * @returns Whether the sheets represent the same persisted content.
 */
export function sameInstanceContent(left: Instance, right: Instance): boolean {
  return sameJsonContent(left, { ...right, modifiedAt: left.modifiedAt });
}
