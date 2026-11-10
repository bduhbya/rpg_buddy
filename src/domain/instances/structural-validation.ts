import { DOCUMENT_SCHEMA_VERSION } from '../definitions/schema-version';
import type { Diagnostic, DiagnosticCode } from '../definitions/diagnostics';
import {
  DEFINITION_VERSION_PATTERN,
  FIELD_ID_PATTERN,
  NONBLANK_TEXT_PATTERN,
  SLUG_PATTERN,
} from '../definitions/definition-patterns';

export type ValidationResult<T> =
  { success: true; value: T } | { success: false; diagnostics: [Diagnostic, ...Diagnostic[]] };

export type JsonObject = Record<string, unknown>;

/**
 * Append an escaped path segment to an RFC 6901 JSON Pointer.
 * @param parent Existing pointer, or an empty string for the document root.
 * @param key Property name or array index to append.
 */
export function childPointer(parent: string, key: string | number): string {
  return `${parent}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

/** Per-call state shared by pure definition validators; never retained globally. */
export class DefinitionChecks {
  readonly diagnostics: Diagnostic[] = [];

  constructor(readonly document: string) {}

  // Record a diagnostic with this validation call's document label.
  issue(pointer: string, message: string, code: DiagnosticCode = 'INVALID_STRUCTURE'): void {
    this.diagnostics.push({ code, document: this.document, pointer, message });
  }

  /** True narrows to an object; property errors accumulate without stopping sibling checks. */
  object(
    value: unknown,
    pointer: string,
    required: readonly string[],
    optional: readonly string[] = [],
  ): value is JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.issue(pointer, 'Expected an object.');
      return false;
    }
    for (const key of required) {
      if (!Object.hasOwn(value, key)) {
        this.issue(childPointer(pointer, key), 'Required property is missing.');
      }
    }
    for (const key of Object.keys(value)) {
      if (!required.includes(key) && !optional.includes(key)) {
        this.issue(childPointer(pointer, key), 'Unknown property is not allowed.');
      }
    }
    return true;
  }

  // Check a string against the expected pattern and optional length limit.
  text(
    value: unknown,
    pointer: string,
    pattern: RegExp = NONBLANK_TEXT_PATTERN,
    maxLength?: number,
  ): void {
    if (
      typeof value !== 'string' ||
      !pattern.test(value) ||
      (maxLength !== undefined && value.length > maxLength)
    ) {
      this.issue(
        pointer,
        `Expected a string matching ${pattern.source}${maxLength === undefined ? '' : ` with at most ${maxLength} characters`}.`,
      );
    }
  }

  // Check an identifier used by systems, templates, and instances.
  slug(value: unknown, pointer: string): void {
    this.text(value, pointer, SLUG_PATTERN, 64);
  }

  // Check the identifier syntax shared by field declarations and references.
  fieldId(value: unknown, pointer: string): void {
    this.text(value, pointer, FIELD_ID_PATTERN, 64);
  }

  /** Expressions allow fractions; input constraints require integers. Neither accepts unsafe integers. */
  number(value: unknown, pointer: string, integer = false): value is number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)) ||
      (integer && !Number.isInteger(value))
    ) {
      this.issue(
        pointer,
        integer
          ? 'Expected a safe integer.'
          : 'Expected a finite number, with integers in the safe range.',
        'INVALID_VALUE',
      );
      return false;
    }
    return true;
  }

  // Check each element of an array for nonblank text.
  texts(value: unknown, pointer: string, minimum = 0): void {
    if (this.array(value, pointer, minimum)) {
      value.forEach((item, index) => this.text(item, childPointer(pointer, index)));
    }
  }

  /** Optional development provenance is checked as data, never resolved as a dependency. */
  metadata(value: unknown, pointer: string): void {
    if (!this.object(value, pointer, [], ['sourceReview', 'requirementRefs', 'sourceRegisterRefs']))
      return;
    if (Object.hasOwn(value, 'sourceReview'))
      this.text(value.sourceReview, childPointer(pointer, 'sourceReview'));
    for (const key of ['requirementRefs', 'sourceRegisterRefs']) {
      if (Object.hasOwn(value, key)) this.texts(value[key], childPointer(pointer, key));
    }
  }

  // Check the version syntax used in definitions and their references.
  version(value: unknown, pointer: string): void {
    this.text(value, pointer, DEFINITION_VERSION_PATTERN);
  }

  // Check a closed exact reference and validate its ID and version.
  reference(value: unknown, pointer: string): value is JsonObject {
    if (!this.object(value, pointer, ['id', 'version'])) return false;
    this.slug(value.id, childPointer(pointer, 'id'));
    this.version(value.version, childPointer(pointer, 'version'));
    return true;
  }

  // Narrow to an array while recording any minimum-length violation.
  array(value: unknown, pointer: string, minimum = 0): value is unknown[] {
    if (!Array.isArray(value)) {
      this.issue(pointer, 'Expected an array.');
      return false;
    }
    if (value.length < minimum) this.issue(pointer, `Expected at least ${minimum} item(s).`);
    return true;
  }

  // Reject an explicitly unsupported version before applying the current schema's shape.
  definitionSchemaVersion(value: unknown): boolean {
    if (
      value !== null &&
      typeof value === 'object' &&
      Object.hasOwn(value, 'schemaVersion') &&
      (value as JsonObject).schemaVersion !== DOCUMENT_SCHEMA_VERSION
    ) {
      this.issue(
        '/schemaVersion',
        `This definition uses an unsupported schema version. Supply a definition that uses schema version ${DOCUMENT_SCHEMA_VERSION}.`,
        'UNSUPPORTED_SCHEMA_VERSION',
      );
      return false;
    }
    return true;
  }

  // Return accumulated diagnostics or expose the value after all checks have run.
  result<T>(value: unknown): ValidationResult<T> {
    const [first, ...rest] = this.diagnostics;
    if (first) return { success: false, diagnostics: [first, ...rest] };
    // Only call after every required property and invariant has been checked.
    // Success preserves object identity; failure never exposes a partially valid value.
    return { success: true, value: value as T };
  }
}
