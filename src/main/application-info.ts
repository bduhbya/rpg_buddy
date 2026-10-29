import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { isApplicationInfoRequest } from '../shared/application-info';
import type { ApplicationInfo, ApplicationInfoResult } from '../shared/application-info';

export function createApplicationInfoHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  getInfo: () => ApplicationInfo,
) {
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
        return { ok: false, code: 'FORBIDDEN' };
      }
      if (args.length !== 1 || !isApplicationInfoRequest(args[0])) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }
      return { ok: true, info: getInfo() };
    } catch {
      return { ok: false, code: 'UNAVAILABLE' };
    }
  };
}
