import path from 'node:path';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { Logger } from '../shared/logging-contract';
import { isSheetSavingRequest } from '../shared/sheet-saving-contract';
import type { SheetSavingRequest, SheetSavingResult } from '../shared/sheet-saving-contract';
import { saveInstance } from './instance-saver';
import { savedInstancePath } from './library-paths';
import type { createSheetEditing } from './sheet-editing';
import { listSheetSaveDestinations } from './sheet-save-destinations';
import { isTrustedMainFrame } from './trusted-frame';
import { createMainWorkflowLog } from './workflow-log';

/**
 * Expose destination discovery and saving to the trusted top-level application document.
 * @param getOwner Supplies the application's web contents.
 * @param trustedDocument Exact URL of the trusted application document.
 * @param editing Supplies the authorized sheet and its current library context.
 * @param logger Shared logger for bridge rejections and persistence outcomes.
 * @returns The save IPC handler. A write uses the snapshot and library authorized at dispatch.
 */
export function createSheetSavingHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  editing: Pick<ReturnType<typeof createSheetEditing>, 'getSaveContext'>,
  logger: Logger,
) {
  const ipcLog = createMainWorkflowLog(logger, 'instance.save');
  const saving = new Set<string>();

  // Authorize the revision before listing destinations or dispatching a write.
  async function dispatch(request: SheetSavingRequest): Promise<SheetSavingResult> {
    const log = createMainWorkflowLog(logger, 'instance.save');
    const context = editing.getSaveContext(request);
    if (!context) {
      return log.failure(
        { ok: false, code: 'STALE_SHEET' },
        { step: 'sheet.check', outcome: 'rejected', reason: 'STALE_SHEET', level: 'warn' },
      );
    }

    const { sheet, root, systemLabel } = context;
    const destinations = listSheetSaveDestinations(sheet, systemLabel);
    if (request.action === 'list') {
      log.outcome({ step: 'destination.list', outcome: 'succeeded', level: 'info' });
      return { ok: true, action: 'list', destinations, hasSaved: context.saved !== null };
    }
    if (!destinations.some(({ id }) => id === request.destinationId)) {
      return log.failure(
        { ok: false, code: 'INVALID_DESTINATION' },
        {
          step: 'destination.check',
          outcome: 'rejected',
          reason: 'INVALID_DESTINATION',
          level: 'warn',
        },
      );
    }

    // Prevent saves from separate edit handles from overtaking one another before the disk lock.
    const target = path.join(root, savedInstancePath(sheet.system.id, sheet.role, sheet.id));
    if (saving.has(target)) {
      return log.failure(
        { ok: false, code: 'BUSY' },
        { step: 'sheet.save', outcome: 'rejected', reason: 'BUSY', level: 'warn' },
      );
    }
    saving.add(target);
    try {
      const result = await saveInstance(root, sheet, logger, context.saved);
      if (!result.success) {
        return { ok: false, code: result.diagnostics[0].code, diagnostics: result.diagnostics };
      }
      context.markSaved(result.value);
      return { ok: true, action: 'save' };
    } finally {
      saving.delete(target);
    }
  }

  // Validate sender and payload before consulting the main-owned edit session.
  return async function handleSheetSaving(
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<SheetSavingResult> {
    if (!isTrustedMainFrame(event, getOwner(), trustedDocument)) {
      return ipcLog.ipcFailure('FORBIDDEN', 'sender.authorize');
    }
    if (args.length !== 1 || !isSheetSavingRequest(args[0])) {
      return ipcLog.ipcFailure('INVALID_REQUEST', 'payload.validate');
    }
    try {
      return await dispatch(args[0]);
    } catch (error) {
      return ipcLog.ipcFailure('UNAVAILABLE', 'request.dispatch', error);
    }
  };
}
