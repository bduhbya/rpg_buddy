/** Shared contract patterns. Keep in sync with the active data contract schemas. */
export const NONBLANK_TEXT_PATTERN = /\S/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DEFINITION_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
export const SOURCE_SHA256_PATTERN = /^[A-F0-9]{64}$/;
export const FIELD_ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
export const UTC_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/;
export const UTC_FRACTION_TRAILING_ZEROS_PATTERN = /0+$/;
