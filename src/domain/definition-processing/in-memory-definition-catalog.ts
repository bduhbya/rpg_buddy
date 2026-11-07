import type { DefinitionReference } from '../definitions/common';
import type { Diagnostic, DiagnosticLocation } from '../definitions/diagnostics';
import type { SystemManifest, Template } from '../definitions/document-models';
import { validateSystemManifest } from './validate-manifest';
import { validateTemplate } from './validate-template';
import { DefinitionChecks } from '../instances/structural-validation';
import type { ValidationResult } from '../instances/structural-validation';

export interface ParsedDefinition {
  document: string;
  value: unknown;
}

export interface LocatedDefinition<T> {
  document: string;
  value: T;
}

/** Lookup locations describe the requesting reference, never filesystem authority. */
export interface InMemoryDefinitionCatalog {
  getSystem(
    reference: DefinitionReference,
    location: DiagnosticLocation,
  ): ValidationResult<LocatedDefinition<SystemManifest>>;
  getTemplate(
    systemId: string,
    reference: DefinitionReference,
    location: DiagnosticLocation,
  ): ValidationResult<LocatedDefinition<Template>>;
}

type Definition = SystemManifest | Template;
type Index<T> = Map<string, Map<string, LocatedDefinition<T>>>;

// Template IDs are scoped to a system. Exact system version compatibility is checked by the resolver.
function templateIdentity(systemId: string, templateId: string): string {
  return JSON.stringify([systemId, templateId]);
}

// Compare JSON content independently of object key order while preserving array order.
function sameContent(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameContent(value, right[index]))
    );
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameContent(a[key], b[key]))
  );
}

// Keep the first entry for an exact version and report duplicates with conflicting content.
function register<T extends Definition>(
  index: Index<T>,
  identity: string,
  entry: LocatedDefinition<T>,
  diagnostics: Diagnostic[],
): void {
  let versions = index.get(identity);
  if (!versions) {
    versions = new Map();
    index.set(identity, versions);
  }
  const previous = versions.get(entry.value.version);
  if (!previous) versions.set(entry.value.version, entry);
  else if (!sameContent(previous.value, entry.value)) {
    diagnostics.push({
      code: 'DEFINITION_CONFLICT',
      document: entry.document,
      pointer: '',
      message: 'Different contents claim the same immutable definition identity/version.',
      related: [{ document: previous.document, pointer: '' }],
    });
  }
}

// Return a copy of the exact match or distinguish an unknown identity from a missing version.
function lookup<T>(
  index: Index<T>,
  identity: string,
  reference: DefinitionReference,
  location: DiagnosticLocation,
): ValidationResult<LocatedDefinition<T>> {
  const versions = index.get(identity);
  const entry = versions?.get(reference.version);
  if (entry) return { success: true, value: structuredClone(entry) };
  return {
    success: false,
    diagnostics: [
      {
        ...location,
        code: versions ? 'UNSUPPORTED_DEFINITION_VERSION' : 'DEFINITION_NOT_FOUND',
        message: versions
          ? `Exact version ${reference.version} of definition ${reference.id} is unavailable; supply that version.`
          : `Definition ${reference.id} is absent; supply the requested definition.`,
      },
    ],
  };
}

/**
 * Validate and snapshot a bundle of parsed definitions. Construction checks local structure and conflicting duplicates. Resolution checks compatibility between documents.
 * @param manifests Parsed system manifests, each with its logical document label.
 * @param templates Parsed templates, each with its logical document label.
 * @returns A catalog whose exact lookups return independent copies, or diagnostics for an invalid bundle.
 */
export function createInMemoryDefinitionCatalog(
  manifests: readonly ParsedDefinition[],
  templates: readonly ParsedDefinition[],
): ValidationResult<InMemoryDefinitionCatalog> {
  const systems: Index<SystemManifest> = new Map();
  const templateIndex: Index<Template> = new Map();
  const diagnostics: Diagnostic[] = [];
  for (const entry of manifests) {
    const result = validateSystemManifest(entry.value, entry.document);
    if (!result.success) diagnostics.push(...result.diagnostics);
    else
      register(
        systems,
        result.value.id,
        { document: entry.document, value: structuredClone(result.value) },
        diagnostics,
      );
  }
  for (const entry of templates) {
    const result = validateTemplate(entry.value, entry.document);
    if (!result.success) diagnostics.push(...result.diagnostics);
    else
      register(
        templateIndex,
        templateIdentity(result.value.system.id, result.value.id),
        { document: entry.document, value: structuredClone(result.value) },
        diagnostics,
      );
  }
  const [first, ...rest] = diagnostics;
  if (first) return { success: false, diagnostics: [first, ...rest] };
  return {
    success: true,
    value: {
      getSystem(reference, location) {
        const checks = new DefinitionChecks(location.document);
        checks.reference(reference, location.pointer);
        const valid = checks.result<DefinitionReference>(reference);
        if (!valid.success) return valid;
        return lookup(systems, reference.id, reference, location);
      },
      getTemplate(systemId, reference, location) {
        const checks = new DefinitionChecks(location.document);
        // Both arguments describe this requested template dependency.
        checks.slug(systemId, location.pointer);
        checks.reference(reference, location.pointer);
        const valid = checks.result<DefinitionReference>(reference);
        if (!valid.success) return valid;
        return lookup(templateIndex, templateIdentity(systemId, reference.id), reference, location);
      },
    },
  };
}
