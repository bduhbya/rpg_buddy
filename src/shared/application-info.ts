import type { LogInput, LogResult } from './logging-contract';
import type { LibraryRequest, LibraryResult } from './library-selection';
export const APPLICATION_INFO_API_VERSION = 1;
export const APPLICATION_INFO_CHANNEL = 'application:get-info';

export interface ApplicationInfoRequest {
  apiVersion: typeof APPLICATION_INFO_API_VERSION;
}

export interface ApplicationInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
}

export type ApplicationInfoResult =
  | { ok: true; info: ApplicationInfo }
  | { ok: false; code: 'INVALID_REQUEST' | 'FORBIDDEN' | 'UNAVAILABLE' };

interface BridgeRequestOptions {
  /** Reject with a sanitized transport error so the workflow can report it. */
  reportTransportFailure?: boolean;
}

export interface ApplicationBridge {
  getApplicationInfo(options?: BridgeRequestOptions): Promise<ApplicationInfoResult>;
  recordLog(input: LogInput): Promise<LogResult>;
  librarySelection(request: LibraryRequest, options?: BridgeRequestOptions): Promise<LibraryResult>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isApplicationInfoRequest(value: unknown): value is ApplicationInfoRequest {
  return (
    record(value) &&
    Object.keys(value).length === 1 &&
    Object.hasOwn(value, 'apiVersion') &&
    value.apiVersion === APPLICATION_INFO_API_VERSION
  );
}

export function isApplicationInfoResult(value: unknown): value is ApplicationInfoResult {
  if (!record(value) || Object.keys(value).length !== 2) return false;
  if (value.ok === false) {
    return ['INVALID_REQUEST', 'FORBIDDEN', 'UNAVAILABLE'].includes(value.code as string);
  }
  if (value.ok !== true || !record(value.info)) return false;
  const keys = ['name', 'version', 'electron', 'chrome', 'node'];
  return (
    Object.keys(value.info).length === keys.length &&
    keys.every((key) => {
      const field = (value.info as Record<string, unknown>)[key];
      return typeof field === 'string' && field.length > 0 && field.length <= 128;
    })
  );
}

/**
 * Request and validate the application information reply.
 * @param invoke IPC transport provided by the preload.
 * @param onTransportFailure Optional callback after a rejected invoke or invalid reply.
 * @returns The checked reply or a transport error if the callback does not throw.
 */
export async function requestApplicationInfo(
  invoke: (channel: string, request: ApplicationInfoRequest) => Promise<unknown>,
  onTransportFailure?: () => void,
): Promise<ApplicationInfoResult> {
  try {
    const result = await invoke(APPLICATION_INFO_CHANNEL, {
      apiVersion: APPLICATION_INFO_API_VERSION,
    });
    if (isApplicationInfoResult(result)) return result;
  } catch {
    // A rejected invoke and an invalid reply are both transport failures.
  }
  onTransportFailure?.();
  return { ok: false, code: 'UNAVAILABLE' };
}
