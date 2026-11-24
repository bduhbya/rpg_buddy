import type { Diagnostic, DiagnosticCode } from '../domain/definitions/diagnostics';
import type { Instance } from '../domain/definitions/document-models';
import type { InstanceEditOperation } from '../domain/instances/edit-instance';
import { isOperationId, isRecord } from './logging-contract';
import { isRogueTraderRulebookEntryId } from './rogue-trader-rulebook-entries';
import type { RogueTraderRulebookEntryId } from './rogue-trader-rulebook-entries';

export const SHEET_EDITING_CHANNEL = 'sheet-editing:apply';

export interface SheetEditHandle {
  token: string;
  revision: number;
}

export type SheetEditOperation =
  | Exclude<InstanceEditOperation, ['add-entry' | 'replace-entry', string]>
  | [operation: 'add-rulebook-entry', entryId: RogueTraderRulebookEntryId];

export interface SheetEditRequest extends SheetEditHandle {
  operation: SheetEditOperation;
}

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

/**
 * Check an untrusted edit request before it reaches the domain.
 * @param value Candidate IPC payload.
 * @returns Whether the payload has exactly the supported fields and operation arguments.
 */
export function isSheetEditRequest(value: unknown): value is SheetEditRequest {
  return (
    isRecord(value) &&
    Object.keys(value).length === 3 &&
    Object.hasOwn(value, 'token') &&
    Object.hasOwn(value, 'revision') &&
    Object.hasOwn(value, 'operation') &&
    isOperationId(value.token) &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    isOperation(value.operation)
  );
}
