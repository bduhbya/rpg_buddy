import type { DefinitionReference } from '../domain/definitions/common';
import type { InstanceRole } from '../domain/definitions/document-models';

export const SYSTEMS_DIRECTORY = 'RPG_systems';

/**
 * Build the canonical role directory for saved sheets.
 * @param systemId Validated system ID.
 * @param role Validated character or monster role.
 * @returns The role directory with forward slashes.
 */
export function savedInstanceDirectory(systemId: string, role: InstanceRole): string {
  const directory = role === 'character' ? 'characters' : 'monsters';
  return `${SYSTEMS_DIRECTORY}/${systemId}/${directory}`;
}

/**
 * Build the canonical library-relative path for a saved sheet.
 * @param systemId Validated system ID.
 * @param role Validated character or monster role.
 * @param instanceId Validated stable instance ID.
 * @returns The saved sheet path with forward slashes.
 */
export function savedInstancePath(
  systemId: string,
  role: InstanceRole,
  instanceId: string,
): string {
  return `${savedInstanceDirectory(systemId, role)}/${instanceId}.json`;
}

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
