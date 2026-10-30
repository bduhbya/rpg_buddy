/** Stable codes from the v1 normative contract; messages are for people. */
export type DiagnosticCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_STRUCTURE'
  | 'INVALID_VALUE'
  | 'DEFINITION_NOT_FOUND'
  | 'UNSUPPORTED_DEFINITION_VERSION'
  | 'IDENTITY_MISMATCH'
  | 'DEFINITION_CONFLICT'
  | 'DUPLICATE_ID'
  | 'INVALID_SECTION'
  | 'INVALID_MODIFIER'
  | 'MODIFIER_CONFLICT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'MISSING_REFERENCE'
  | 'TYPE_MISMATCH'
  | 'DEPENDENCY_CYCLE'
  | 'DIVISION_BY_ZERO'
  | 'NONFINITE_RESULT';

export interface DiagnosticLocation {
  /** Logical document identity, not filesystem authority. */
  document: string;
  /** RFC 6901 JSON Pointer; an empty string identifies the document root. */
  pointer: string;
}

export interface Diagnostic extends DiagnosticLocation {
  code: DiagnosticCode;
  message: string;
  related?: DiagnosticLocation[];
}
