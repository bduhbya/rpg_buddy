import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { isSheetCreationRequest } from '../shared/sheet-creation-contract';
import type { Logger } from '../shared/logging-contract';
import type { SheetCreationWorkflow } from './sheet-creation-workflow';
import { isTrustedMainFrame } from './trusted-frame';
import { createMainWorkflowLog } from './workflow-log';

/**
 * Restrict sheet creation to the application window's trusted document.
 * @param getOwner Supplies the current application's web contents.
 * @param trustedDocument Exact URL of the application document.
 * @param workflow Main-process creation operations.
 * @param logger Shared logger for rejected bridge requests.
 * @returns Handlers for listing template choices and creating sheets.
 */
export function createSheetCreationHandlers(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  workflow: SheetCreationWorkflow,
  logger: Logger,
) {
  const log = createMainWorkflowLog(logger, 'instance.create');
  const message = 'The sheet creation request could not be completed.';

  // Check the owner on every request so a replaced window loses access.
  function isTrusted(event: IpcMainInvokeEvent): boolean {
    return isTrustedMainFrame(event, getOwner(), trustedDocument);
  }

  return {
    // Listing options requires no renderer-supplied parameters.
    handleGetSheetCreationOptions(event: IpcMainInvokeEvent, ...args: unknown[]) {
      if (!isTrusted(event)) return log.ipcFailure('FORBIDDEN', 'sender.authorize');
      if (args.length !== 0) return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
      return { ok: true as const, options: workflow.getSheetCreationOptions() };
    },

    // Validate the closed payload before handing it to the workflow.
    handleCreateCharacterSheet(event: IpcMainInvokeEvent, ...args: unknown[]) {
      if (!isTrusted(event)) {
        return { ...log.ipcFailure('FORBIDDEN', 'sender.authorize'), message };
      }
      if (args.length !== 1 || !isSheetCreationRequest(args[0])) {
        return { ...log.ipcFailure('INVALID_REQUEST', 'payload.validate'), message };
      }
      return workflow.createCharacterSheet(args[0]);
    },
  };
}
