import type { Diagnostic, DiagnosticCode } from './diagnostics';
import {
  DEFINITION_VERSION_PATTERN,
  FIELD_ID_PATTERN,
  NONBLANK_TEXT_PATTERN,
  SLUG_PATTERN,
} from './definition-patterns';

export type ValidationResult<T> =
  { success: true; value: T } | { success: false; diagnostics: [Diagnostic, ...Diagnostic[]] };

export type JsonObject = Record<string, unknown>;

/** Escape one RFC 6901 segment, including unknown property names. */
export function childPointer(parent: string, key: string | number): string {
  return `${parent}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

/** Per-call state shared by pure definition validators; never retained globally. */
export class DefinitionChecks {
  readonly diagnostics: Diagnostic[] = [];

  constructor(readonly document: string) {}

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

  slug(value: unknown, pointer: string): void {
    this.text(value, pointer, SLUG_PATTERN, 64);
  }

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

  version(value: unknown, pointer: string): void {
    this.text(value, pointer, DEFINITION_VERSION_PATTERN);
  }

  reference(value: unknown, pointer: string): value is JsonObject {
    if (!this.object(value, pointer, ['id', 'version'])) return false;
    this.slug(value.id, childPointer(pointer, 'id'));
    this.version(value.version, childPointer(pointer, 'version'));
    return true;
  }

  array(value: unknown, pointer: string, minimum = 0): value is unknown[] {
    if (!Array.isArray(value)) {
      this.issue(pointer, 'Expected an array.');
      return false;
    }
    if (value.length < minimum) this.issue(pointer, `Expected at least ${minimum} item(s).`);
    return true;
  }

  schemaVersion(value: JsonObject): void {
    if (Object.hasOwn(value, 'schemaVersion') && value.schemaVersion !== 1) {
      this.issue(
        '/schemaVersion',
        'Expected supported schema version 1.',
        'UNSUPPORTED_SCHEMA_VERSION',
      );
    }
  }

  result<T>(value: unknown): ValidationResult<T> {
    const [first, ...rest] = this.diagnostics;
    if (first) return { success: false, diagnostics: [first, ...rest] };
    // Only call after every required property and invariant has been checked.
    // Success preserves object identity; failure never exposes a partially valid value.
    return { success: true, value: value as T };
  }
}
