import { randomUUID } from 'node:crypto';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { InMemoryDefinitionCatalog } from '../domain/definition-processing/in-memory-definition-catalog';
import type { Instance } from '../domain/definitions/document-models';
import { editInstance } from '../domain/instances/edit-instance';
import type { Logger } from '../shared/logging-contract';
import { sameInstanceContent } from '../domain/instances/same-instance-content';
import { isSheetEditPreviewRequest, isSheetEditRequest } from '../shared/sheet-editing-contract';
import { ROGUE_TRADER_RULEBOOK_ENTRIES } from '../shared/rogue-trader-rulebook-entries';
import type { InstanceEditOperation } from '../domain/instances/edit-instance';
import type {
  SheetEditHandle,
  SheetEditPreviewRequest,
  SheetEditPreviewResult,
  SheetEditOperation,
  SheetEditRequest,
  SheetEditResult,
} from '../shared/sheet-editing-contract';
import type { LibrarySelection } from './library-selection';
import { isTrustedMainFrame } from './trusted-frame';
import { createMainWorkflowLog } from './workflow-log';

type SheetSource = 'created' | 'opened';

interface EditableSheet {
  sheet: Instance;
  saved: Instance | null;
  initial: Instance;
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
    sheets.set(source, {
      sheet,
      saved: source === 'opened' ? sheet : null,
      initial: sheet,
      catalog,
      selectionRevision,
      handle,
    });
    return handle;
  }

  // A successfully opened read-only sheet supersedes the prior open result.
  function clearOpened(): void {
    sheets.delete('opened');
  }

  // Resolve the current editable snapshot together with its authorized library.
  function resolveActive(request: SheetEditHandle) {
    const context = selection.getCreationContext();
    const active = [...sheets.values()].find(({ handle }) => handle.token === request.token);
    if (
      !context ||
      !active ||
      active.handle.revision !== request.revision ||
      active.selectionRevision !== context.revision
    ) {
      return undefined;
    }
    return { active, context };
  }

  // Capture the current snapshot and destination context before filesystem work begins.
  function getSaveContext(request: SheetEditHandle) {
    const resolved = resolveActive(request);
    if (!resolved) return undefined;
    const { active, context } = resolved;
    return {
      sheet: active.sheet,
      saved: active.saved,
      root: context.root,
      systemLabel: context.system.manifest.label,
      // Track the persisted baseline even if a later in-memory edit arrived during the write.
      markSaved(persisted: Instance): void {
        active.saved = persisted;
      },
    };
  }

  // Advance the revision whenever an authoritative replacement is published.
  function publish(active: EditableSheet, sheet: Instance): SheetEditResult {
    active.sheet = sheet;
    active.handle = { token: active.handle.token, revision: active.handle.revision + 1 };
    return { ok: true, sheet, editHandle: active.handle };
  }

  // Translate a permitted bridge operation into the same operation for Apply and preview.
  function resolveOperation(
    sheet: Instance,
    request: Exclude<SheetEditOperation, ['discard-changes']>,
  ): InstanceEditOperation | undefined {
    if (request[0] !== 'add-rulebook-entry') return request;
    if (sheet.system.id !== 'rogue-trader') return undefined;
    return ['add-entry', JSON.stringify(ROGUE_TRADER_RULEBOOK_ENTRIES[request[1]])];
  }

  // Replay pending edits on private snapshots and compare the resulting derived values too.
  function preview(request: SheetEditPreviewRequest): SheetEditPreviewResult {
    const resolved = resolveActive(request);
    if (!resolved) return { ok: false, code: 'STALE_SHEET' };
    const { active } = resolved;
    let sheet = active.sheet;
    for (const requested of request.operations) {
      const operation = resolveOperation(sheet, requested);
      if (!operation) return { ok: false, code: 'INVALID_REQUEST' };
      const result = editInstance(
        active.catalog,
        sheet,
        { now: () => new Date().toISOString() },
        'sheet edit preview',
        ...operation,
      );
      // Leave invalid drafts actionable through the usual edit validation path.
      if (!result.success) return { ok: true, hasChanges: true };
      sheet = result.value;
    }
    return { ok: true, hasChanges: !sameInstanceContent(sheet, active.saved ?? active.initial) };
  }

  // Check the revision and publish the complete domain result in a single synchronous turn.
  function apply(request: SheetEditRequest): SheetEditResult {
    const log = createMainWorkflowLog(logger, 'instance.edit');
    const resolved = resolveActive(request);
    if (!resolved) {
      return log.failure(
        { ok: false, code: 'STALE_SHEET' },
        { step: 'sheet.check', outcome: 'rejected', reason: 'STALE_SHEET', level: 'warn' },
      );
    }

    try {
      const { active } = resolved;
      const requested = request.operation;
      if (requested[0] === 'discard-changes') {
        const result = publish(active, active.saved ?? active.initial);
        log.outcome({ step: 'sheet.discard', outcome: 'succeeded', level: 'info' });
        return result;
      }
      const operation = resolveOperation(active.sheet, requested);
      if (!operation) {
        return log.failure(
          { ok: false, code: 'INVALID_REQUEST' },
          { step: 'entry.resolve', outcome: 'rejected', reason: 'INVALID_REQUEST', level: 'warn' },
        );
      }
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
      return publish(active, result.value);
    } catch (error) {
      return log.failure(
        { ok: false, code: 'UNAVAILABLE' },
        { step: 'sheet.apply', outcome: 'failed', reason: 'UNAVAILABLE', level: 'error' },
        error,
      );
    }
  }

  return { register, clearOpened, apply, preview, getSaveContext };
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

/**
 * Expose read-only edit previews to the trusted top-level application document.
 * @param getOwner Supplies the current application's web contents.
 * @param trustedDocument Exact URL of the trusted application document.
 * @param preview Main-process preview operation.
 * @param logger Shared logger for IPC rejections.
 * @returns The preview IPC handler.
 */
export function createSheetEditPreviewHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  preview: (request: SheetEditPreviewRequest) => SheetEditPreviewResult,
  logger: Logger,
) {
  const log = createMainWorkflowLog(logger, 'instance.edit');

  // Authorize and validate the request before evaluating any drafts.
  return function handlePreview(
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): SheetEditPreviewResult {
    if (!isTrustedMainFrame(event, getOwner(), trustedDocument)) {
      return log.ipcFailure('FORBIDDEN', 'sender.authorize');
    }
    if (args.length !== 1 || !isSheetEditPreviewRequest(args[0])) {
      return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
    }
    try {
      return preview(args[0]);
    } catch (error) {
      return log.ipcFailure('UNAVAILABLE', 'sheet.preview', error);
    }
  };
}
