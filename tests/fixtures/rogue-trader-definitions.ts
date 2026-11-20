import { readFileSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { SystemManifest } from '../../src/domain/definitions/document-models';

const RUNTIME_SYSTEM = new URL('../../runtime-library/RPG_systems/rogue-trader/', import.meta.url);
const AUTHORED_EXAMPLES = new URL('../../data_contracts/examples/v2/', import.meta.url);

// Read one fixture set's own manifest so system and template versions can advance independently.
function readFixtureDefinitions(root: URL) {
  const manifest = JSON.parse(readFileSync(new URL('system.json', root), 'utf8')) as SystemManifest;
  const system = { id: manifest.id, version: manifest.version };
  const template = manifest.templates.find(({ id }) => id === 'creature-core');
  if (!template) throw new Error(`Missing creature-core reference in ${root.href}`);
  return {
    root,
    manifest,
    system,
    template,
    archivePath: `manifests/${system.version}/system.json`,
    templatePath: `templates/${template.id}/${template.version}/template.json`,
  };
}

/**
 * Read the active Rogue Trader seed references for application tests.
 * @returns Fresh manifest data and the exact relative paths declared by the seed.
 */
export function readRuntimeDefinitions() {
  return readFixtureDefinitions(RUNTIME_SYSTEM);
}

/**
 * Read the authored Rogue Trader references used by the contract examples.
 * @returns Fresh manifest data and the exact relative paths declared by the examples.
 */
export function readAuthoredDefinitions() {
  return readFixtureDefinitions(AUTHORED_EXAMPLES);
}

/**
 * Copy the authored archived manifest and exact template into a disposable library.
 * @param libraryRoot Destination library root.
 * @param definitions Authored fixture references and source paths.
 * @returns Canonical library-relative paths with forward slashes.
 */
export async function seedAuthoredDefinitions(
  libraryRoot: string,
  definitions: ReturnType<typeof readAuthoredDefinitions>,
) {
  const system = `RPG_systems/${definitions.system.id}`;
  const manifest = `${system}/${definitions.archivePath}`;
  const template = `${system}/${definitions.templatePath}`;

  for (const [document, fixture] of [
    [manifest, 'system.json'],
    [template, definitions.templatePath],
  ]) {
    const file = path.join(libraryRoot, document);
    await mkdir(path.dirname(file), { recursive: true });
    await copyFile(new URL(fixture, definitions.root), file);
  }
  return { system, manifest, template };
}
