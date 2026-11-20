import { readFileSync } from 'node:fs';
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
