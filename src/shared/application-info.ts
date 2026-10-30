import type { LogInput, LogResult } from './logging-contract';
export const APPLICATION_INFO_CHANNEL = 'application:get-info';

export interface ApplicationInfoRequest {
  apiVersion: 1;
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

export interface ApplicationBridge {
  getApplicationInfo(): Promise<ApplicationInfoResult>;
  recordLog(input: LogInput): Promise<LogResult>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isApplicationInfoRequest(value: unknown): value is ApplicationInfoRequest {
  return (
    record(value) &&
    Object.keys(value).length === 1 &&
    Object.hasOwn(value, 'apiVersion') &&
    value.apiVersion === 1
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

export async function requestApplicationInfo(
  invoke: (channel: string, request: ApplicationInfoRequest) => Promise<unknown>,
): Promise<ApplicationInfoResult> {
  try {
    const result = await invoke(APPLICATION_INFO_CHANNEL, { apiVersion: 1 });
    return isApplicationInfoResult(result) ? result : { ok: false, code: 'UNAVAILABLE' };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}
