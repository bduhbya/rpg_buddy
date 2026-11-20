import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { Logger } from '../shared/logging-contract';
import { isSheetLoadingRequest } from '../shared/sheet-loading-contract';
import type { SheetLoadingWorkflow } from '../shared/sheet-loading-contract';
import { isTrustedMainFrame } from './trusted-frame';
import { createMainWorkflowLog } from './workflow-log';

/**
 * Restrict saved-sheet requests to the application window's trusted main frame.
 * @param getOwner Supplies the current application web contents.
 * @param trustedDocument Exact URL of the application document.
 * @param requestSheet Validated sheet loading workflow.
 * @param logger Shared logger for rejected bridge requests.
 * @returns The IPC handler for sheet discovery and opening.
 */
export function createSheetLoadingHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  requestSheet: SheetLoadingWorkflow,
  logger: Logger,
) {
  const log = createMainWorkflowLog(logger, 'instance.load');

  // Authorize the sender before checking and dispatching its payload.
  return function handleSheetLoading(event: IpcMainInvokeEvent, ...args: unknown[]) {
    if (!isTrustedMainFrame(event, getOwner(), trustedDocument)) {
      return log.ipcFailure('FORBIDDEN', 'sender.authorize');
    }
    if (args.length !== 1 || !isSheetLoadingRequest(args[0])) {
      return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
    }
    return requestSheet(args[0]);
  };
}
