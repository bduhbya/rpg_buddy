import { readFileSync } from 'node:fs';
import type { Instance, SystemManifest, Template } from '../../src/domain/documents';

/**
 * Test-only access to authored fixtures checked by the Python contract verifier.
 * This cast is not runtime validation and must not become a production loader.
 * Each call parses fresh objects so tests cannot mutate another test's fixtures.
 */
function readAuthoredFixture<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../data_contracts/examples/${path}`, import.meta.url), 'utf8'),
  ) as T;
}

export function loadFixtures() {
  return {
    manifest: readAuthoredFixture<SystemManifest>('system.json'),
    template: readAuthoredFixture<Template>('templates/creature-core/1.0.0/template.json'),
    character: readAuthoredFixture<Instance>('explorator.instance.json'),
    monster: readAuthoredFixture<Instance>('ork-freebooter.instance.json'),
  };
}
