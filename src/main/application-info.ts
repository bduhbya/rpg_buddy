import { isTrustedMainFrame } from './trusted-frame';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { isApplicationInfoRequest } from '../shared/application-info';
import type { ApplicationInfo, ApplicationInfoResult } from '../shared/application-info';
import { noopLogger } from '../shared/logging-contract';
import type { Logger } from '../shared/logging-contract';
import { createMainWorkflowLog } from './workflow-log';

/**
 * Serve application metadata only to the trusted renderer.
 * @param getOwner Supplies the window that owns the application bridge.
 * @param trustedDocument The exact URL of the trusted renderer document.
 * @param getInfo Supplies the application and runtime versions.
 * @param logger Shared logger for bounded IPC failure reports.
 * @returns A handler that returns application metadata or a typed failure.
 */
export function createApplicationInfoHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  getInfo: () => ApplicationInfo,
  logger: Logger = noopLogger,
) {
  const log = createMainWorkflowLog(logger, 'application.info');

  return (event: IpcMainInvokeEvent, ...args: unknown[]): ApplicationInfoResult => {
    try {
      const owner = getOwner();
      if (!isTrustedMainFrame(event, owner, trustedDocument))
        return log.ipcFailure('FORBIDDEN', 'sender.authorize');
      if (args.length !== 1 || !isApplicationInfoRequest(args[0])) {
        return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
      }
      return { ok: true, info: getInfo() };
    } catch (error) {
      return log.ipcFailure('UNAVAILABLE', 'request.dispatch', error);
    }
  };
}
