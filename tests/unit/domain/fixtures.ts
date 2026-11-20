import { readAuthoredDefinitions } from '../../fixtures/rogue-trader-definitions';
import { readFileSync } from 'node:fs';
import type { Instance, Template } from '../../../src/domain/definitions/document-models';

/**
 * Test-only access to authored fixtures checked by the Python contract verifier.
 * This cast is not runtime validation and must not become a production loader.
 * Each call parses fresh objects so tests cannot mutate another test's fixtures.
 */
function readAuthoredFixture<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../../data_contracts/examples/v2/${path}`, import.meta.url), 'utf8'),
  ) as T;
}

/**
 * Load fresh authored definitions and example sheets for a domain test.
 * @returns Independent manifest, template, character and monster fixtures.
 */
export function loadFixtures() {
  const { manifest, templatePath } = readAuthoredDefinitions();
  return {
    manifest,
    template: readAuthoredFixture<Template>(templatePath),
    character: readAuthoredFixture<Instance>('explorator.instance.json'),
    monster: readAuthoredFixture<Instance>('ork-freebooter.instance.json'),
  };
}
