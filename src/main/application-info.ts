import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { isApplicationInfoRequest } from '../shared/application-info';
import type { ApplicationInfo, ApplicationInfoResult } from '../shared/application-info';
import { randomUUID } from 'node:crypto';
import { noopLogger, sanitizeError } from '../shared/logging-contract';
import type { Logger } from '../shared/logging-contract';

export function createApplicationInfoHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  getInfo: () => ApplicationInfo,
  logger: Logger = noopLogger,
) {
  let lastReport = -Infinity;
  function reject(
    code: 'FORBIDDEN' | 'INVALID_REQUEST' | 'UNAVAILABLE',
    error?: unknown,
  ): ApplicationInfoResult {
    if (Date.now() - lastReport >= 1000) {
      lastReport = Date.now();
      try {
        logger.record({
          event: 'application.info.failed',
          level: 'warn',
          reason: code,
          operationId: randomUUID(),
          ...(error === undefined ? {} : { error: sanitizeError(error) }),
        });
      } catch {
        /* Diagnostics cannot change the IPC result. */
      }
    }
    return { ok: false, code };
  }
  return (event: IpcMainInvokeEvent, ...args: unknown[]): ApplicationInfoResult => {
    try {
      const owner = getOwner();
      const frame = event.senderFrame;
      if (
        !owner ||
        owner.isDestroyed() ||
        event.sender !== owner ||
        !frame ||
        frame !== owner.mainFrame ||
        frame.url !== trustedDocument ||
        owner.getURL() !== trustedDocument
      ) {
        return reject('FORBIDDEN');
      }
      if (args.length !== 1 || !isApplicationInfoRequest(args[0])) {
        return reject('INVALID_REQUEST');
      }
      return { ok: true, info: getInfo() };
    } catch (error) {
      return reject('UNAVAILABLE', error);
    }
  };
}
