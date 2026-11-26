import type { Diagnostic, DiagnosticCode } from '../domain/definitions/diagnostics';
import type { Instance } from '../domain/definitions/document-models';
import type { InstanceEditOperation } from '../domain/instances/edit-instance';
import { isOperationId, isRecord } from './logging-contract';
import { isRogueTraderRulebookEntryId } from './rogue-trader-rulebook-entries';
import type { RogueTraderRulebookEntryId } from './rogue-trader-rulebook-entries';

export const SHEET_EDITING_CHANNEL = 'sheet-editing:apply';
export const SHEET_EDIT_PREVIEW_CHANNEL = 'sheet-editing:preview';
const MAX_PREVIEW_OPERATIONS = 128;

export interface SheetEditHandle {
  token: string;
  revision: number;
}

export type SheetEditOperation =
  | Exclude<InstanceEditOperation, ['add-entry' | 'replace-entry', string]>
  | [operation: 'discard-changes']
  | [operation: 'add-rulebook-entry', entryId: RogueTraderRulebookEntryId];

export interface SheetEditRequest extends SheetEditHandle {
  operation: SheetEditOperation;
}

export interface SheetEditPreviewRequest extends SheetEditHandle {
  operations: Exclude<SheetEditOperation, ['discard-changes']>[];
}

export type SheetEditPreviewResult =
  | { ok: true; hasChanges: boolean }
  | { ok: false; code: 'FORBIDDEN' | 'INVALID_REQUEST' | 'STALE_SHEET' | 'UNAVAILABLE' };

export type SheetEditResult =
  | { ok: true; sheet: Instance; editHandle: SheetEditHandle }
  | {
      ok: false;
      code: DiagnosticCode | 'FORBIDDEN' | 'INVALID_REQUEST' | 'STALE_SHEET' | 'UNAVAILABLE';
      diagnostics?: Diagnostic[];
    };

// Limit the bridge to the primitive argument tuples supported by the domain.
function isOperation(value: unknown): value is SheetEditOperation {
  if (!Array.isArray(value)) return false;
  const [action, argument, fieldValue] = value;
  switch (action) {
    case 'discard-changes':
      return value.length === 1;
    case 'set-value':
      return value.length === 3 && typeof argument === 'string' && Number.isFinite(fieldValue);
    case 'set-career':
      return value.length === 2 && (argument === null || typeof argument === 'string');
    case 'set-display-name':
    case 'remove-entry':
      return value.length === 2 && typeof argument === 'string';
    case 'add-rulebook-entry':
      return value.length === 2 && isRogueTraderRulebookEntryId(argument);
    default:
      return false;
  }
}

// Verify the common edit capability fields before inspecting either request payload.
function isEditHandle(value: unknown): value is Record<string, unknown> & SheetEditHandle {
  return (
    isRecord(value) &&
    Object.hasOwn(value, 'token') &&
    Object.hasOwn(value, 'revision') &&
    isOperationId(value.token) &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0
  );
}

/**
 * Validate a bounded sequence of pending operations for an authorized preview.
 * @param value Candidate IPC payload.
 * @returns Whether it contains a valid capability and editable operations.
 */
export function isSheetEditPreviewRequest(value: unknown): value is SheetEditPreviewRequest {
  return (
    isEditHandle(value) &&
    Object.keys(value).length === 3 &&
    Object.hasOwn(value, 'operations') &&
    Array.isArray(value.operations) &&
    value.operations.length > 0 &&
    value.operations.length <= MAX_PREVIEW_OPERATIONS &&
    Array.from(value.operations).every(
      (operation) => isOperation(operation) && operation[0] !== 'discard-changes',
    )
  );
}

/**
 * Check an untrusted edit request before it reaches the domain.
 * @param value Candidate IPC payload.
 * @returns Whether the payload has exactly the supported fields and operation arguments.
 */
export function isSheetEditRequest(value: unknown): value is SheetEditRequest {
  return (
    isEditHandle(value) &&
    Object.keys(value).length === 3 &&
    Object.hasOwn(value, 'operation') &&
    isOperation(value.operation)
  );
}
