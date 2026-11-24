import { randomUUID } from 'node:crypto';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { InMemoryDefinitionCatalog } from '../domain/definition-processing/in-memory-definition-catalog';
import type { Instance } from '../domain/definitions/document-models';
import { editInstance } from '../domain/instances/edit-instance';
import type { Logger } from '../shared/logging-contract';
import { isSheetEditRequest } from '../shared/sheet-editing-contract';
import { ROGUE_TRADER_RULEBOOK_ENTRIES } from '../shared/rogue-trader-rulebook-entries';
import type { InstanceEditOperation } from '../domain/instances/edit-instance';
import type {
  SheetEditHandle,
  SheetEditRequest,
  SheetEditResult,
} from '../shared/sheet-editing-contract';
import type { LibrarySelection } from './library-selection';
import { isTrustedMainFrame } from './trusted-frame';
import { createMainWorkflowLog } from './workflow-log';

type SheetSource = 'created' | 'opened';

interface EditableSheet {
  sheet: Instance;
  catalog: InMemoryDefinitionCatalog;
  selectionRevision: number;
  handle: SheetEditHandle;
}

/**
 * Manage the latest created and opened editable snapshots for the app.
 * @param selection Supplies the current library selection revision.
 * @param logger Shared main-process diagnostic logger.
 * @returns Operations for registering, invalidating, and applying edits to sheets.
 */
export function createSheetEditing(
  selection: Pick<LibrarySelection, 'getCreationContext'>,
  logger: Logger,
) {
  const sheets = new Map<SheetSource, EditableSheet>();

  // Keep at most one edit handle per workflow and retain the exact definitions used there.
  function register(
    source: SheetSource,
    sheet: Instance,
    catalog: InMemoryDefinitionCatalog,
    selectionRevision: number,
  ): SheetEditHandle {
    const handle = { token: randomUUID(), revision: 0 };
    sheets.set(source, { sheet, catalog, selectionRevision, handle });
    return handle;
  }

  // A successfully opened read-only sheet supersedes the prior open result.
  function clearOpened(): void {
    sheets.delete('opened');
  }

  // Check the revision and publish the complete domain result in a single synchronous turn.
  function apply(request: SheetEditRequest): SheetEditResult {
    const log = createMainWorkflowLog(logger, 'instance.edit');
    const active = [...sheets.values()].find(({ handle }) => handle.token === request.token);
    if (
      !active ||
      active.handle.revision !== request.revision ||
      active.selectionRevision !== selection.getCreationContext()?.revision
    ) {
      return log.failure(
        { ok: false, code: 'STALE_SHEET' },
        { step: 'sheet.check', outcome: 'rejected', reason: 'STALE_SHEET', level: 'warn' },
      );
    }

    try {
      const requested = request.operation;
      if (requested[0] === 'add-rulebook-entry' && active.sheet.system.id !== 'rogue-trader') {
        return log.failure(
          { ok: false, code: 'INVALID_REQUEST' },
          { step: 'entry.resolve', outcome: 'rejected', reason: 'INVALID_REQUEST', level: 'warn' },
        );
      }
      const operation: InstanceEditOperation =
        requested[0] === 'add-rulebook-entry'
          ? ['add-entry', JSON.stringify(ROGUE_TRADER_RULEBOOK_ENTRIES[requested[1]])]
          : requested;
      const result = editInstance(
        active.catalog,
        active.sheet,
        { now: () => new Date().toISOString() },
        { document: 'sheet edit', logging: { logger, operationId: log.operationId } },
        ...operation,
      );
      if (!result.success) {
        return { ok: false, code: result.diagnostics[0].code, diagnostics: result.diagnostics };
      }
      active.sheet = result.value;
      active.handle = { token: active.handle.token, revision: active.handle.revision + 1 };
      return { ok: true, sheet: active.sheet, editHandle: active.handle };
    } catch (error) {
      return log.failure(
        { ok: false, code: 'UNAVAILABLE' },
        { step: 'sheet.apply', outcome: 'failed', reason: 'UNAVAILABLE', level: 'error' },
        error,
      );
    }
  }

  return { register, clearOpened, apply };
}

/**
 * Expose edits only to the trusted top-level application document.
 * @param getOwner Supplies the current application's web contents.
 * @param trustedDocument Exact URL of the trusted application document.
 * @param apply Main-process edit operation.
 * @param logger Shared logger for IPC rejections.
 * @returns The registered edit IPC handler.
 */
export function createSheetEditingHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  apply: (request: SheetEditRequest) => SheetEditResult,
  logger: Logger,
) {
  const log = createMainWorkflowLog(logger, 'instance.edit');

  // Reject the sender and payload before dispatching to the edit session.
  return function handleSheetEdit(event: IpcMainInvokeEvent, ...args: unknown[]): SheetEditResult {
    if (!isTrustedMainFrame(event, getOwner(), trustedDocument)) {
      return log.ipcFailure('FORBIDDEN', 'sender.authorize');
    }
    if (args.length !== 1 || !isSheetEditRequest(args[0])) {
      return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
    }
    return apply(args[0]);
  };
}
