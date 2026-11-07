import { UTC_FRACTION_TRAILING_ZEROS_PATTERN, UTC_TIMESTAMP_PATTERN } from './definition-patterns';

/**
 * Validate a v1 UTC timestamp with calendar-valid seconds and optional fractional seconds.
 * @param value Candidate value from an untrusted source.
 * @returns Whether the value is a valid timestamp string ending in Z.
 */
export function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  // Compare calendar components to reject Date.parse's normalization of invalid dates.
  const date = new Date(`${match[1]}Z`);
  return date.toJSON()?.slice(0, 19) === match[1];
}

/**
 * Compare validated UTC timestamps without rounding their fractional seconds.
 * @param candidate Timestamp to compare.
 * @param current Reference timestamp.
 * @returns Whether the candidate represents an earlier instant.
 */
export function isEarlierUtcTimestamp(candidate: string, current: string): boolean {
  function sortable(timestamp: string): string {
    // Fixed-width seconds and trimmed fractional digits sort in chronological order.
    const seconds = timestamp.slice(0, 19);
    const fraction = timestamp.slice(20, -1).replace(UTC_FRACTION_TRAILING_ZEROS_PATTERN, '');
    return seconds + fraction;
  }
  return sortable(candidate) < sortable(current);
}
