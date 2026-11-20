import { INSTANCE_ROLES } from '../domain/definitions/document-models';
import type { Instance, InstanceRole } from '../domain/definitions/document-models';
import type { Diagnostic, DiagnosticCode } from '../domain/definitions/diagnostics';
import { isSystemId } from './library-selection';
import { isRecord } from './logging-contract';

export const SHEET_LOADING_CHANNEL = 'sheet-loading:request';

export type SheetLoadingRequest =
  | { action: 'list'; role: InstanceRole }
  | { action: 'open'; role: InstanceRole; id: string; selectionRevision: number };

/** A canonical saved-sheet ID and its display name, when readable. */
export interface SavedSheetChoice {
  id: string;
  displayName?: string;
}

export type SheetLoadingResult =
  | { ok: true; action: 'list'; sheets: SavedSheetChoice[]; selectionRevision: number }
  | { ok: true; action: 'open'; mode: 'editable'; sheet: Instance }
  | { ok: true; action: 'open'; mode: 'read-only'; sheet: Instance; diagnostics: Diagnostic[] }
  | {
      ok: false;
      code:
        | DiagnosticCode
        | 'FORBIDDEN'
        | 'INVALID_REQUEST'
        | 'STALE_SELECTION'
        | 'BUSY'
        | 'UNAVAILABLE'
        | 'LIBRARY_UNAVAILABLE';
      diagnostics?: Diagnostic[];
    };

/** Handles a validated sheet loading request and returns its typed result. */
export type SheetLoadingWorkflow = (request: SheetLoadingRequest) => Promise<SheetLoadingResult>;

/**
 * Validate an untrusted sheet loading request before dispatch.
 * @param value Candidate IPC payload.
 * @returns Whether the payload matches a supported action and its exact fields.
 */
export function isSheetLoadingRequest(value: unknown): value is SheetLoadingRequest {
  if (!isRecord(value) || !INSTANCE_ROLES.some((role) => role === value.role)) return false;
  const keys = Object.keys(value).length;
  if (value.action === 'list') return keys === 2;
  return (
    value.action === 'open' &&
    keys === 4 &&
    isSystemId(value.id) &&
    typeof value.selectionRevision === 'number' &&
    Number.isSafeInteger(value.selectionRevision) &&
    value.selectionRevision >= 0
  );
}
