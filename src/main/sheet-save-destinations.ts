import type { Instance } from '../domain/definitions/document-models';
import type { SheetSaveDestination } from '../shared/sheet-saving-contract';

// TODO: Replace these defaults with valid destinations from the system definition
// when the library storage contract supports system-defined locations.
const roleDestinations = {
  character: { id: 'characters', label: 'Characters' },
  monster: { id: 'monsters', label: 'Monsters' },
} satisfies Record<Instance['role'], SheetSaveDestination>;

/**
 * Resolve the library destinations offered for this editable sheet.
 * @param sheet Current authoritative sheet snapshot.
 * @param systemLabel Label from the selected system.
 * @returns Destination IDs and display labels for the sheet's role.
 */
export function listSheetSaveDestinations(
  sheet: Instance,
  systemLabel: string,
): SheetSaveDestination[] {
  // TODO: Resolve allowed destinations from the system definition once supported.
  const { id, label } = roleDestinations[sheet.role];
  return [{ id, label: `${systemLabel} › ${label}` }];
}
