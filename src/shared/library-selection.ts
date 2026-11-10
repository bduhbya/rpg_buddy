import { SLUG_PATTERN } from '../domain/definitions/definition-patterns';
import { isRecord } from './logging-contract';

export const LIBRARY_API_VERSION = 1;
export const LIBRARY_SELECTION_CHANNEL = 'library:selection';

export type LibraryRequest =
  | { apiVersion: typeof LIBRARY_API_VERSION; action: 'get' }
  | { apiVersion: typeof LIBRARY_API_VERSION; action: 'choose' }
  | { apiVersion: typeof LIBRARY_API_VERSION; action: 'load'; systemId: string };

export interface LibraryView {
  folderName: string | null;
  systemIds: string[];
  activeSystem: { id: string; label: string } | null;
  issue: string | null;
}

export type LibraryOutcome = 'current' | 'accepted' | 'cancelled' | 'superseded' | 'failed';

export type LibraryResult =
  | { ok: true; outcome: LibraryOutcome; view: LibraryView }
  | { ok: false; code: 'FORBIDDEN' | 'INVALID_REQUEST' | 'UNAVAILABLE' };

const LIBRARY_OUTCOMES: readonly string[] = [
  'current',
  'accepted',
  'cancelled',
  'superseded',
  'failed',
];
const LIBRARY_ERROR_CODES: readonly string[] = ['FORBIDDEN', 'INVALID_REQUEST', 'UNAVAILABLE'];

/**
 * Check whether a value is a valid system ID for discovery or selection.
 * @param value Untrusted directory name or request field.
 * @returns Whether the value is a lowercase slug of at most 64 characters.
 */
export function isSystemId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && SLUG_PATTERN.test(value);
}

/**
 * Validate the closed, versioned library IPC request.
 * @param value Untrusted request. Only a load action carries a system ID.
 * @returns Whether the request is safe to dispatch.
 */
export function isLibraryRequest(value: unknown): value is LibraryRequest {
  if (
    !isRecord(value) ||
    !Object.hasOwn(value, 'apiVersion') ||
    value.apiVersion !== LIBRARY_API_VERSION ||
    !Object.hasOwn(value, 'action')
  )
    return false;
  const keys = Object.keys(value);
  return value.action === 'load'
    ? keys.length === 3 && Object.hasOwn(value, 'systemId') && isSystemId(value.systemId)
    : keys.length === 2 && (value.action === 'get' || value.action === 'choose');
}

// Check the renderer-facing snapshot shape before passing it across the bridge.
function isLibraryView(value: unknown): value is LibraryView {
  if (!isRecord(value) || Object.keys(value).length !== 4) return false;
  const { folderName, systemIds, activeSystem, issue } = value;
  return (
    (folderName === null || typeof folderName === 'string') &&
    Array.isArray(systemIds) &&
    systemIds.every(isSystemId) &&
    (activeSystem === null ||
      (isRecord(activeSystem) &&
        Object.keys(activeSystem).length === 2 &&
        isSystemId(activeSystem.id) &&
        typeof activeSystem.label === 'string')) &&
    (issue === null || typeof issue === 'string')
  );
}

// Accept only the known success and transport error reply shapes.
function isLibraryResult(value: unknown): value is LibraryResult {
  if (!isRecord(value)) return false;
  if (value.ok === false) {
    return Object.keys(value).length === 2 && LIBRARY_ERROR_CODES.includes(value.code as string);
  }
  return (
    value.ok === true &&
    Object.keys(value).length === 3 &&
    LIBRARY_OUTCOMES.includes(value.outcome as string) &&
    isLibraryView(value.view)
  );
}

/**
 * Send a library action through the preload bridge.
 * @param invoke IPC transport provided by the preload.
 * @param request A versioned library action.
 * @param onTransportFailure Optional callback after a rejected invoke or invalid reply.
 * @returns The checked reply or a transport error if the callback does not throw.
 */
export async function requestLibrary(
  invoke: (channel: string, request: LibraryRequest) => Promise<unknown>,
  request: LibraryRequest,
  onTransportFailure?: () => void,
): Promise<LibraryResult> {
  if (!isLibraryRequest(request)) return { ok: false, code: 'INVALID_REQUEST' };
  try {
    const result = await invoke(LIBRARY_SELECTION_CHANNEL, request);
    if (isLibraryResult(result)) return result;
  } catch {
    // A rejected invoke and an invalid reply are both transport failures.
  }
  onTransportFailure?.();
  return { ok: false, code: 'UNAVAILABLE' };
}
