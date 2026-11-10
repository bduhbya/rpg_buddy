import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { DiagnosticCode } from '../domain/definitions/diagnostics';
import { parseStrictJson } from '../domain/definitions/strict-json';
import type { ValidationResult } from '../domain/instances/structural-validation';

type LoadFailure = Extract<ValidationResult<never>, { success: false }>;
type DocumentKind = 'definition' | 'saved sheet';

// Wrap one loader diagnostic in the same result format as domain validation.
function failure(
  document: string,
  code: DiagnosticCode,
  message: string,
  pointer = '',
): LoadFailure {
  return { success: false, diagnostics: [{ document, code, message, pointer }] };
}

// Keep the existing missing-definition code for exact lookup and describe missing sheets separately.
function missingFile(document: string, kind: DocumentKind, location: string): LoadFailure {
  const code = kind === 'definition' ? 'DEFINITION_NOT_FOUND' : 'INVALID_VALUE';
  return failure(document, code, `Supply the ${kind} ${location}.`);
}

// Distinguish missing files from read failures without exposing absolute paths or OS error text.
function fileFailure(document: string, error: unknown, kind: DocumentKind): LoadFailure {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    return missingFile(document, kind, 'at its library path');
  }
  return failure(document, 'INVALID_VALUE', `The ${kind} file or its directory could not be read.`);
}

/**
 * Resolve the chosen library directory before opening any documents.
 * @param root Absolute path to the selected library.
 * @returns Its resolved path or a library selection diagnostic.
 */
export async function resolveLibraryRoot(root: string): Promise<ValidationResult<string>> {
  if (!path.isAbsolute(root)) {
    return failure('library selection', 'INVALID_VALUE', 'Choose an absolute library folder.');
  }
  try {
    const resolved = await realpath(root);
    if ((await lstat(resolved)).isDirectory()) return { success: true, value: resolved };
  } catch {
    // Treat missing and inaccessible folders the same in user-facing feedback.
  }
  return failure('library selection', 'INVALID_VALUE', 'Choose a readable library folder.');
}

/**
 * Read strict UTF-8 JSON from a canonical library-relative path.
 * @param root Resolved library root.
 * @param document Canonical path constructed from validated identifiers, using forward slashes.
 * @param kind Document type used in file diagnostics.
 * @returns Parsed JSON or diagnostics. The file is opened read-only.
 */
export async function readLibraryJson(
  root: string,
  document: string,
  kind: DocumentKind,
): Promise<ValidationResult<unknown>> {
  let bytes: Uint8Array;
  try {
    // Check every component before reading so a directory junction cannot redirect the lookup.
    const segments = document.split('/');
    let file = root;
    for (const [index, segment] of segments.entries()) {
      file = path.join(file, segment);
      const info = await lstat(file);
      if (info.isSymbolicLink()) {
        return failure(
          document,
          'INVALID_VALUE',
          'Use ordinary files and directories inside the library.',
        );
      }
      const expectedType = index === segments.length - 1 ? info.isFile() : info.isDirectory();
      if (!expectedType) {
        return failure(
          document,
          'INVALID_VALUE',
          'The library path does not contain the expected file or directory.',
        );
      }
    }
    // Check the final resolved path against the selected root before opening the file.
    const resolved = await realpath(file);
    const relative = path.relative(root, resolved);
    if (
      !relative ||
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)
    ) {
      return failure(document, 'INVALID_VALUE', `The ${kind} path must stay inside the library.`);
    }
    // Windows can resolve an incorrectly cased path. Require its on-disk spelling.
    if (relative.split(path.sep).join('/') !== document) {
      return missingFile(document, kind, 'at the exact library path, including capitalization');
    }
    bytes = await readFile(resolved);
  } catch (error) {
    return fileFailure(document, error, kind);
  }

  let json: string;
  try {
    // Reject malformed UTF-8 before parsing can accept replacement characters as text.
    json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return failure(document, 'INVALID_JSON', `Provide a valid UTF-8 JSON ${kind}.`);
  }
  return parseStrictJson(json, document);
}
