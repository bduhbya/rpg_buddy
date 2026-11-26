import type { Diagnostic, DiagnosticCode } from '../domain/definitions/diagnostics';
import { isOperationId, isRecord } from './logging-contract';
import { isSystemId } from './library-selection';
import type { SheetEditHandle } from './sheet-editing-contract';

export const SHEET_SAVING_CHANNEL = 'sheet-saving:request';

export interface SheetSaveDestination {
  id: string;
  label: string;
}

export type SheetSavingRequest = SheetEditHandle &
  ({ action: 'list' } | { action: 'save'; destinationId: string });

export type SheetSavingResult =
  | { ok: true; action: 'list'; destinations: SheetSaveDestination[]; hasSaved: boolean }
  | { ok: true; action: 'save' }
  | {
      ok: false;
      code:
        | DiagnosticCode
        | 'FORBIDDEN'
        | 'INVALID_REQUEST'
        | 'INVALID_DESTINATION'
        | 'STALE_SHEET'
        | 'BUSY'
        | 'UNAVAILABLE';
      diagnostics?: Diagnostic[];
    };

/**
 * Validate the action and its exact argument shape before using the edit capability.
 * @param value Untrusted IPC request.
 * @returns Whether the payload requests destination discovery or a save by destination ID.
 */
export function isSheetSavingRequest(value: unknown): value is SheetSavingRequest {
  if (
    !isRecord(value) ||
    !Object.hasOwn(value, 'action') ||
    !Object.hasOwn(value, 'token') ||
    !Object.hasOwn(value, 'revision') ||
    !isOperationId(value.token) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  ) {
    return false;
  }
  const allowedFields = new Set(['action', 'token', 'revision']);
  if (value.action === 'save') {
    if (!Object.hasOwn(value, 'destinationId') || !isSystemId(value.destinationId)) return false;
    allowedFields.add('destinationId');
  } else if (value.action !== 'list') {
    return false;
  }

  return Object.keys(value).every((field) => allowedFields.has(field));
}
