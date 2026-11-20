import type { DefinitionReference } from '../domain/definitions/common';
import { INSTANCE_ROLES } from '../domain/definitions/document-models';
import { DEFINITION_VERSION_PATTERN } from '../domain/definitions/definition-patterns';
import { isSystemId } from './library-selection';
import { isRecord } from './logging-contract';
import type { Instance, InstanceRole } from '../domain/definitions/document-models';
import type { DiagnosticCode } from '../domain/definitions/diagnostics';

/** Template choices for the currently loaded library and system. */
export interface SheetCreationOptions {
  /** Copy this revision into the creation request so main can reject stale selections. */
  selectionRevision: number;
  /** Each choice pairs an exact template ID and version with its display label. */
  templates: { reference: DefinitionReference; label: string }[];
}

/** User input for creating one in-memory sheet from an active template. */
export interface SheetCreationRequest {
  /** Revision from the options used to select the template. */
  selectionRevision: number;
  /** Exact ID and version of a template offered by the active system. */
  template: DefinitionReference;
  /** Role selected for the sheet, which determines where it belongs in the library. */
  role: InstanceRole;
  /** Nonblank name for display. Creation trims leading and trailing whitespace. */
  displayName: string;
  /** User-chosen portable slug that becomes the stable sheet ID and future filename stem. */
  id: string;
}

export const SHEET_CREATION_OPTIONS_CHANNEL = 'sheet-creation:options';
export const CREATE_CHARACTER_SHEET_CHANNEL = 'sheet-creation:create';

export type SheetCreationOptionsResult =
  | { ok: true; options: SheetCreationOptions | null }
  | { ok: false; code: 'FORBIDDEN' | 'INVALID_REQUEST' };

export type SheetCreationFailureCode =
  | DiagnosticCode
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'STALE_SELECTION'
  | 'ID_OCCUPIED'
  | 'LIBRARY_UNAVAILABLE'
  | 'UNAVAILABLE';

export type SheetCreationResult =
  | { ok: true; sheet: Instance }
  | {
      ok: false;
      code: SheetCreationFailureCode;
      message: string;
      field?: 'displayName' | 'id' | 'role' | 'template';
    };

/**
 * Validate the shape of an untrusted creation request before dispatch.
 * @param value Payload received from the renderer.
 * @returns Whether the request has exactly the expected fields and types.
 */
export function isSheetCreationRequest(value: unknown): value is SheetCreationRequest {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 5 ||
    typeof value.selectionRevision !== 'number' ||
    !Number.isSafeInteger(value.selectionRevision) ||
    value.selectionRevision < 0 ||
    typeof value.displayName !== 'string' ||
    typeof value.id !== 'string' ||
    !INSTANCE_ROLES.some((role) => role === value.role)
  ) {
    return false;
  }
  const { template } = value;
  return (
    isRecord(template) &&
    Object.keys(template).length === 2 &&
    isSystemId(template.id) &&
    typeof template.version === 'string' &&
    DEFINITION_VERSION_PATTERN.test(template.version)
  );
}
