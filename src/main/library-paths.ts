import type { DefinitionReference } from '../domain/definitions/common';

export const SYSTEMS_DIRECTORY = 'RPG_systems';

/**
 * Build the library-relative path to a system's active manifest.
 * @param systemId Validated system ID.
 * @returns The canonical path with forward slashes, suitable as a diagnostic label.
 */
export function activeSystemManifestPath(systemId: string): string {
  return `${SYSTEMS_DIRECTORY}/${systemId}/system.json`;
}

/**
 * Build the library-relative path to an exact archived system manifest.
 * @param system Validated system ID and version.
 * @returns The canonical path with forward slashes, suitable as a diagnostic label.
 */
export function archivedSystemManifestPath(system: DefinitionReference): string {
  return `${SYSTEMS_DIRECTORY}/${system.id}/manifests/${system.version}/system.json`;
}

/**
 * Build the library-relative path to an exact template definition.
 * @param systemId Validated system ID.
 * @param template Validated template ID and version.
 * @returns The canonical path with forward slashes, suitable as a diagnostic label.
 */
export function templateDefinitionPath(systemId: string, template: DefinitionReference): string {
  return `${SYSTEMS_DIRECTORY}/${systemId}/templates/${template.id}/${template.version}/template.json`;
}
