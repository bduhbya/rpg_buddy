/** Shared v1 contract patterns. Keep in sync with data_contracts/v1 schemas. */
export const NONBLANK_TEXT_PATTERN = /\S/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DEFINITION_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
export const SOURCE_SHA256_PATTERN = /^[A-F0-9]{64}$/;
export const FIELD_ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
