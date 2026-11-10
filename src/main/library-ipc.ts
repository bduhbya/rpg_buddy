import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { isLibraryRequest } from '../shared/library-selection';
import type { LibraryResult } from '../shared/library-selection';
import { noopLogger } from '../shared/logging-contract';
import type { Logger } from '../shared/logging-contract';
import type { LibrarySelection } from './library-selection';
import { isTrustedMainFrame } from './trusted-frame';
import { createMainWorkflowLog } from './workflow-log';

/**
 * Create the trusted IPC handler for reading and changing the library selection.
 * @param getOwner Supplies the window that owns the application bridge.
 * @param trustedDocument The exact URL of the trusted renderer document.
 * @param selection Main-process library state.
 * @param pickFolder Opens the native directory picker for the requesting window.
 * @param logger Shared application logger for IPC-owned failures.
 * @returns A handler that rejects unauthorized senders and malformed actions.
 */
export function createLibraryHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  selection: Pick<LibrarySelection, 'getView' | 'chooseFolder' | 'selectSystem'>,
  pickFolder: (owner: WebContents) => Promise<string | undefined>,
  logger: Logger = noopLogger,
) {
  const log = createMainWorkflowLog(logger, 'library.request');

  return async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<LibraryResult> => {
    try {
      const owner = getOwner();
      if (!isTrustedMainFrame(event, owner, trustedDocument))
        return log.ipcFailure('FORBIDDEN', 'sender.authorize');
      if (args.length !== 1 || !isLibraryRequest(args[0])) {
        return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
      }
      const request = args[0];
      switch (request.action) {
        case 'get':
          return await selection.getView();
        case 'choose':
          return await selection.chooseFolder(() => pickFolder(owner));
        case 'load':
          return await selection.selectSystem(request.systemId);
      }
    } catch (error) {
      return log.ipcFailure('UNAVAILABLE', 'request.dispatch', error);
    }
  };
}
