import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { planCalculations } from '../domain/calculation/plan-calculations';
import { checkDerivedExpressionTypes } from '../domain/definition-processing/validate-expression';
import { createInMemoryDefinitionCatalog } from '../domain/definition-processing/in-memory-definition-catalog';
import type {
  InMemoryDefinitionCatalog,
  LocatedDefinition,
} from '../domain/definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../domain/definition-processing/resolve-definitions';
import type {
  DefinitionRequest,
  ResolvedDefinitions,
} from '../domain/definition-processing/resolve-definitions';
import { validateSystemManifest } from '../domain/definition-processing/validate-manifest';
import { validateTemplate } from '../domain/definition-processing/validate-template';
import type { DefinitionReference } from '../domain/definitions/common';
import type { DiagnosticCode } from '../domain/definitions/diagnostics';
import type { SystemManifest, Template } from '../domain/definitions/document-models';
import { sameJsonContent } from '../domain/definitions/json-content';
import { parseStrictJson } from '../domain/definitions/strict-json';
import { DefinitionChecks } from '../domain/instances/structural-validation';
import type { ValidationResult } from '../domain/instances/structural-validation';
import { noopLogger, sanitizeError } from '../shared/logging-contract';
import type { LogEvent, LogInput, LogLevel, Logger } from '../shared/logging-contract';
import {
  activeSystemManifestPath,
  archivedSystemManifestPath,
  templateDefinitionPath,
} from './library-paths';

export interface LoadedSystem {
  manifest: SystemManifest;
  catalog: InMemoryDefinitionCatalog;
}

type LoadFailure = Extract<ValidationResult<never>, { success: false }>;

// Write best-effort product diagnostics without changing the loader's result.
function recordLoadEvent(logger: Logger, input: LogInput): void {
  try {
    logger.record(input);
  } catch {
    // A logging failure must never interrupt definition loading.
  }
}

// Set up a best-effort logger with one operation ID. Setup writes no events.
// The failure event name is used only when a check rejects the load or an exception occurs.
function createDefinitionLoadLog(logger: Logger, failedEvent: LogEvent) {
  const operationId = randomUUID();
  return {
    // Record a milestone in this load. Progress events default to debug.
    record(event: LogEvent, level: LogLevel = 'debug'): void {
      recordLoadEvent(logger, { event, level, operationId });
    },
    // Record the diagnostic code as the reason and return the original diagnostic to the caller.
    reject(result: LoadFailure): LoadFailure {
      recordLoadEvent(logger, {
        event: failedEvent,
        level: 'warn',
        operationId,
        reason: result.diagnostics[0].code,
      });
      return result;
    },
    // Record an unexpected exception with sanitized details before it propagates.
    unexpected(error: unknown): void {
      recordLoadEvent(logger, {
        event: failedEvent,
        level: 'error',
        operationId,
        reason: 'UNAVAILABLE',
        error: sanitizeError(error),
      });
    },
  };
}

// Wrap one loader diagnostic in the same result format as domain validation.
function failure(
  document: string,
  code: DiagnosticCode,
  message: string,
  pointer = '',
): LoadFailure {
  return { success: false, diagnostics: [{ document, code, message, pointer }] };
}

// Distinguish missing files from read failures without exposing absolute paths or OS error text.
function fileFailure(document: string, error: unknown): LoadFailure {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    return failure(document, 'DEFINITION_NOT_FOUND', 'Supply the definition at its library path.');
  }
  return failure(
    document,
    'INVALID_VALUE',
    'The definition file or its directory could not be read.',
  );
}

// Resolve the chosen folder once so all definition reads in one load use the same base path.
async function resolveLibraryRoot(root: string): Promise<ValidationResult<string>> {
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

// Read strict UTF-8 JSON from a canonical, library-relative definition path.
async function readDefinition(root: string, document: string): Promise<ValidationResult<unknown>> {
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
      return failure(
        document,
        'INVALID_VALUE',
        'The definition path must stay inside the library.',
      );
    }
    // Windows can resolve an incorrectly cased path. Require its on-disk spelling.
    if (relative.split(path.sep).join('/') !== document) {
      return failure(
        document,
        'DEFINITION_NOT_FOUND',
        'Supply the definition at the exact library path, including capitalization.',
      );
    }
    bytes = await readFile(resolved);
  } catch (error) {
    return fileFailure(document, error);
  }

  let json: string;
  try {
    // Reject malformed UTF-8 before parsing can accept replacement characters as text.
    json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return failure(document, 'INVALID_JSON', 'Provide a valid UTF-8 JSON definition.');
  }
  return parseStrictJson(json, document);
}

// Validate the manifest's structure and match its identity to the system path and archive revision.
async function readManifest(root: string, document: string, id: string, version?: string) {
  const parsed = await readDefinition(root, document);
  if (!parsed.success) return parsed;
  const manifest = validateSystemManifest(parsed.value, document);
  if (!manifest.success) return manifest;
  if (manifest.value.id !== id) {
    return failure(document, 'IDENTITY_MISMATCH', 'System ID must match its directory.', '/id');
  }
  if (version !== undefined && manifest.value.version !== version) {
    return failure(
      document,
      'IDENTITY_MISMATCH',
      'System version must match its archive directory.',
      '/version',
    );
  }
  return manifest;
}

// Load a template at its exact canonical path and check its static formula semantics.
async function readTemplate(
  root: string,
  system: DefinitionReference,
  reference: DefinitionReference,
) {
  const document = templateDefinitionPath(system.id, reference);
  const parsed = await readDefinition(root, document);
  if (!parsed.success) return parsed;
  const template = validateTemplate(parsed.value, document);
  if (!template.success) return template;
  if (template.value.id !== reference.id) {
    return failure(document, 'IDENTITY_MISMATCH', 'Template ID must match its directory.', '/id');
  }
  if (template.value.version !== reference.version) {
    return failure(
      document,
      'IDENTITY_MISMATCH',
      'Template version must match its directory.',
      '/version',
    );
  }
  if (template.value.system.id !== system.id) {
    return failure(
      document,
      'IDENTITY_MISMATCH',
      'Template system ID must match its system directory.',
      '/system/id',
    );
  }
  // Check the dependency graph and operand types without running any formulas.
  const located = { document, value: template.value };
  const order = planCalculations(located);
  if (!order.success) return order;
  const checks = new DefinitionChecks(document);
  checkDerivedExpressionTypes(template.value, checks);
  return checks.result<LocatedDefinition<Template>>(located);
}

/**
 * Call when a user selects a system directory under RPG_systems. The active manifest
 * determines which templates are available for creating new sheets.
 * This function runs independently of loadExactDefinitions.
 * @param libraryRootPath Absolute filesystem path to the selected library folder.
 * @param systemDirectoryName Candidate system ID from a directory entry, available before any definition files are read.
 * @param logger Application logger. Omit to skip recording product logs.
 * @returns The active manifest and complete catalog, or diagnostics without a partial catalog.
 */
export async function loadActiveSystem(
  libraryRootPath: string,
  systemDirectoryName: unknown,
  logger: Logger = noopLogger,
): Promise<ValidationResult<LoadedSystem>> {
  // Configure the failure event for this load. The first event written is started.
  const log = createDefinitionLoadLog(logger, 'library.definitions.active.failed');
  log.record('library.definitions.active.started');
  try {
    const checks = new DefinitionChecks('system selection');
    checks.slug(systemDirectoryName, '/systemId');
    const validatedDirectoryName = checks.result<string>(systemDirectoryName);
    if (!validatedDirectoryName.success) return log.reject(validatedDirectoryName);
    const resolvedLibraryRoot = await resolveLibraryRoot(libraryRootPath);
    if (!resolvedLibraryRoot.success) return log.reject(resolvedLibraryRoot);

    // Use the directory name to locate system.json, then verify the manifest declares that ID.
    const activeManifestPath = activeSystemManifestPath(validatedDirectoryName.value);
    const active = await readManifest(
      resolvedLibraryRoot.value,
      activeManifestPath,
      validatedDirectoryName.value,
    );
    if (!active.success) return log.reject(active);
    log.record('library.definitions.active.manifest.validated');

    // The active manifest supplies the revision and template references for the remaining reads.
    const activeManifest = active.value;
    const archivedManifestPath = archivedSystemManifestPath(activeManifest);
    const archive = await readManifest(
      resolvedLibraryRoot.value,
      archivedManifestPath,
      activeManifest.id,
      activeManifest.version,
    );
    if (!archive.success) return log.reject(archive);
    if (!sameJsonContent(active.value, archive.value)) {
      return log.reject(
        failure(
          archivedManifestPath,
          'DEFINITION_CONFLICT',
          'The active manifest and its exact archive must have identical contents.',
        ),
      );
    }

    log.record('library.definitions.active.archive.validated');

    // Follow only the manifest's exact template references. Other revisions stay on disk.
    const templates = [];
    for (const reference of activeManifest.templates) {
      const template = await readTemplate(resolvedLibraryRoot.value, activeManifest, reference);
      if (!template.success) return log.reject(template);
      templates.push(template.value);
    }
    log.record('library.definitions.active.templates.validated');
    // Publish the catalog only after every declared pair passes cross-document resolution.
    const catalog = createInMemoryDefinitionCatalog(
      [{ document: archivedManifestPath, value: archive.value }],
      templates,
    );
    if (!catalog.success) return log.reject(catalog);
    for (const template of activeManifest.templates) {
      const resolved = resolveDefinitions(
        catalog.value,
        { system: { id: activeManifest.id, version: activeManifest.version }, template },
        activeManifestPath,
      );
      if (!resolved.success) return log.reject(resolved);
    }
    log.record('library.definitions.active.completed', 'info');
    return { success: true, value: { manifest: activeManifest, catalog: catalog.value } };
  } catch (error) {
    log.unexpected(error);
    throw error;
  }
}

/**
 * Load and validate the exact archived system manifest and template identified by the caller.
 * A saved-sheet loader can call this after reading the instance to resolve its definition references.
 * This function reads only the definition files and runs independently of loadActiveSystem.
 * @param libraryRootPath Absolute filesystem path to the selected library folder.
 * @param definitionReferences Exact system and template IDs and versions supplied by the caller, such as from a saved sheet. The loader validates them before building filesystem paths.
 * @param logger Application logger. Omit to skip recording product logs.
 * @returns The resolved definitions or diagnostics. No catalog is retained by the loader.
 */
export async function loadExactDefinitions(
  libraryRootPath: string,
  definitionReferences: unknown,
  logger: Logger = noopLogger,
): Promise<ValidationResult<ResolvedDefinitions>> {
  // Configure the failure event for this load. The first event written is started.
  const log = createDefinitionLoadLog(logger, 'library.definitions.exact.failed');
  log.record('library.definitions.exact.started');
  try {
    const checks = new DefinitionChecks('definition request');
    if (checks.object(definitionReferences, '', ['system', 'template'])) {
      checks.reference(definitionReferences.system, '/system');
      checks.reference(definitionReferences.template, '/template');
    }
    const validatedReferences = checks.result<DefinitionRequest>(definitionReferences);
    if (!validatedReferences.success) return log.reject(validatedReferences);
    const resolvedLibraryRoot = await resolveLibraryRoot(libraryRootPath);
    if (!resolvedLibraryRoot.success) return log.reject(resolvedLibraryRoot);
    const { system: systemReference, template: templateReference } = validatedReferences.value;
    const archivedManifestPath = archivedSystemManifestPath(systemReference);
    const manifest = await readManifest(
      resolvedLibraryRoot.value,
      archivedManifestPath,
      systemReference.id,
      systemReference.version,
    );
    if (!manifest.success) return log.reject(manifest);
    log.record('library.definitions.exact.archive.validated');
    // Verify membership before opening the requested template path.
    if (
      !manifest.value.templates.some(
        (entry) => entry.id === templateReference.id && entry.version === templateReference.version,
      )
    ) {
      return log.reject(
        failure(
          archivedManifestPath,
          'IDENTITY_MISMATCH',
          'The requested exact template must be listed in the archived manifest.',
          '/templates',
        ),
      );
    }
    const loaded = await readTemplate(
      resolvedLibraryRoot.value,
      systemReference,
      templateReference,
    );
    if (!loaded.success) return log.reject(loaded);
    log.record('library.definitions.exact.template.validated');
    const catalog = createInMemoryDefinitionCatalog(
      [{ document: archivedManifestPath, value: manifest.value }],
      [loaded.value],
    );
    if (!catalog.success) return log.reject(catalog);
    const resolved = resolveDefinitions(
      catalog.value,
      validatedReferences.value,
      'definition request',
    );
    if (!resolved.success) return log.reject(resolved);
    log.record('library.definitions.exact.completed', 'info');
    return resolved;
  } catch (error) {
    log.unexpected(error);
    throw error;
  }
}
