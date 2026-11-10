import type { IpcMainInvokeEvent, WebContents } from 'electron';

/**
 * Check that an IPC request came from the application's trusted top-level document.
 * @param event Electron IPC event.
 * @param owner Current application window's web contents.
 * @param trustedDocument The exact URL the owner and its main frame must both use.
 * @returns Whether the owner exists and the sender is its trusted main frame.
 */
export function isTrustedMainFrame(
  event: IpcMainInvokeEvent,
  owner: WebContents | undefined,
  trustedDocument: string,
): owner is WebContents {
  if (!owner || owner.isDestroyed() || event.sender !== owner) return false;
  const frame = event.senderFrame;
  return (
    !!frame &&
    frame === owner.mainFrame &&
    frame.url === trustedDocument &&
    owner.getURL() === trustedDocument
  );
}
