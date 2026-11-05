import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateWithEntries } from '../../../src/domain/calculation/calculate-with-entries';
import { createInstance } from '../../../src/domain/instances/create-instance';
import type { Instance } from '../../../src/domain/documents';
import { createInMemoryDefinitionCatalog } from '../../../src/domain/definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../../../src/domain/definition-processing/resolve-definitions';
import { entryFixture, multiplyEffect } from './effect-fixtures';
import { loadFixtures } from './fixtures';

const root = '../../../runtime-library/RPG_systems/rogue-trader/';
const templatePath = 'templates/creature-core/1.0.0/template.json';

// Test-only file access. Unknown JSON must cross the production validation boundary.
function readRuntime(path: string): unknown {
  return JSON.parse(readFileSync(new URL(root + path, import.meta.url), 'utf8'));
}

function runtimeCatalog() {
  const active = readRuntime('system.json');
  const archive = readRuntime('manifests/1.0.0/system.json');
  expect(active).toEqual(archive);
  const result = createInMemoryDefinitionCatalog(
    [
      { document: 'system.json', value: active },
      { document: 'manifests/1.0.0/system.json', value: archive },
    ],
    [{ document: templatePath, value: readRuntime(templatePath) }],
  );
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function resolvedTemplate(instance: Instance) {
  const result = resolveDefinitions(
    runtimeCatalog(),
    { system: instance.system, template: instance.template },
    instance.id,
  );
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  return result.value.template;
}

function statistics(sb: number, tb: number, ab: number, movement: readonly number[]) {
  return {
    strengthBonus: sb,
    toughnessBonus: tb,
    agilityBonus: ab,
    halfMove: movement[0],
    fullMove: movement[1],
    chargeMove: movement[2],
    runMove: movement[3],
  };
}

function calculate(instance: Instance, entries: unknown = instance.entries) {
  return calculateWithEntries(
    resolvedTemplate(instance),
    { document: 'values', value: instance.values },
    { document: 'entries', value: entries },
  );
}

describe('Rogue Trader runtime definitions', () => {
  it('preserves the approved structure, citations and accessible presentation metadata', () => {
    const template = resolvedTemplate(loadFixtures().character).value;
    // Promotion may omit development provenance, but must preserve the approved rules and presentation.
    const approved = JSON.parse(
      JSON.stringify(loadFixtures().template, (key, value: unknown) =>
        key === 'metadata' ? undefined : value,
      ),
    ) as unknown;
    expect(template).toEqual(approved);
    expect(template.inputs.map((field) => [field.id, field.default])).toEqual([
      ['weaponSkill', 0],
      ['ballisticSkill', 0],
      ['strength', 0],
      ['toughness', 0],
      ['agility', 0],
      ['intelligence', 0],
      ['perception', 0],
      ['willpower', 0],
      ['fellowship', 0],
    ]);
    expect(template.defaultDisplayName).toBe('Creature');
    expect(template.modifierTargets).toEqual(['strengthBonus', 'toughnessBonus']);
    expect(template.sections.map((section) => section.id)).toEqual([
      'characteristics',
      'bonuses',
      'movement',
    ]);
    expect(template.derived.slice(3).map((field) => field.unit)).toEqual(
      Array(4).fill('metres/round'),
    );
    for (const field of [...template.inputs, ...template.derived]) {
      expect(field.label.trim()).not.toBe('');
      expect(field.sourceRefs).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Rogue Trader Core Rulebook (2009, RT01, Print ID 01), printed p',
          ),
        ]),
      );
    }
    expect(readRuntime('system.json')).toEqual(loadFixtures().manifest);
  });

  it('creates independent blank sheets for both roles and calculates their defaults', () => {
    const catalog = runtimeCatalog();
    const references = {
      system: { id: 'rogue-trader', version: '1.0.0' },
      template: { id: 'creature-core', version: '1.0.0' },
    };
    const defaults = {
      weaponSkill: 0,
      ballisticSkill: 0,
      strength: 0,
      toughness: 0,
      agility: 0,
      intelligence: 0,
      perception: 0,
      willpower: 0,
      fellowship: 0,
    };
    const timestamp = '2026-11-05T15:00:00Z';
    let nextId = 0;
    const providers = { newId: () => `blank-${++nextId}`, now: () => timestamp };
    const create = (role: Instance['role'], expectedId: string) => {
      const result = createInstance(catalog, { ...references, role }, providers, 'blank-sheet');
      expect(result).toEqual({
        success: true,
        value: {
          schemaVersion: 1,
          ...references,
          id: expectedId,
          entityType: 'creature',
          role,
          displayName: 'Creature',
          values: defaults,
          entries: [],
          createdAt: timestamp,
          modifiedAt: timestamp,
        },
      });
      if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
      return result.value;
    };

    const character = create('character', 'blank-1');
    const monster = create('monster', 'blank-2');
    // Check that changes to one instance do not leak into another.
    character.values.agility = 40;
    character.entries.push({
      id: 'custom',
      category: 'custom',
      label: 'Custom',
      description: '',
      effects: [],
    });
    expect(monster.values).toEqual(defaults);
    expect(monster.entries).toEqual([]);
    const anotherCharacter = create('character', 'blank-3');

    for (const instance of [monster, anotherCharacter]) {
      expect(calculate(instance)).toEqual({
        success: true,
        value: statistics(0, 0, 0, [0.5, 1, 2, 3]),
      });
    }
  });

  it('resolves both roles and matches independent worked and edited results', () => {
    const { character, monster } = loadFixtures();
    expect(calculate(character)).toEqual({
      success: true,
      value: statistics(4, 3, 3, [3, 6, 9, 18]),
    });
    expect(calculate(monster)).toEqual({
      success: true,
      value: statistics(5, 8, 3, [3, 6, 9, 18]),
    });
    character.values.agility = 40;
    expect(calculate(character)).toEqual({
      success: true,
      value: statistics(4, 3, 4, [4, 8, 12, 24]),
    });
    // Floor the score into a bonus before applying x2: T49 gives 8, not 9.
    for (const [score, tb] of [
      [49, 8],
      [50, 10],
    ]) {
      monster.values.toughness = score;
      expect(calculate(monster)).toEqual({
        success: true,
        value: statistics(5, tb, 3, [3, 6, 9, 18]),
      });
    }
  });

  // Independent expected rows include the movement table's special zero-bonus case.
  it.each([
    [0, 0, 0, [0.5, 1, 2, 3]],
    [9, 0, 0, [0.5, 1, 2, 3]],
    [10, 1, 2, [1, 2, 3, 6]],
    [39, 3, 6, [3, 6, 9, 18]],
    [40, 4, 8, [4, 8, 12, 24]],
    [99, 9, 18, [9, 18, 27, 54]],
  ] as const)(
    'matches base and snapshot-adjusted boundaries at %s',
    (score, bonus, tb, movement) => {
      const { character, monster } = loadFixtures();
      for (const instance of [character, monster]) {
        Object.assign(instance.values, { strength: score, toughness: score, agility: score });
        expect(calculate(instance)).toEqual({
          success: true,
          value: statistics(bonus, instance === monster ? tb : bonus, bonus, movement),
        });
      }
    },
  );

  it('keeps effects generic and instance-owned across JSON round trips', () => {
    const original = loadFixtures().monster;
    // Exercise plain JSON data, without relying on shared objects or runtime-only behavior.
    const restored = JSON.parse(JSON.stringify(original)) as Instance;
    // Only the explicit effect supplies mechanics; role, label and category are descriptive.
    restored.role = 'character';
    restored.entries[0].label = 'A custom selection';
    restored.entries[0].category = 'custom';
    expect(calculate(restored)).toEqual({
      success: true,
      value: statistics(5, 8, 3, [3, 6, 9, 18]),
    });
    // Removing the restored snapshot's effect returns TB to 4 without changing the original's TB8.
    restored.entries = [];
    expect(calculate(restored)).toEqual({
      success: true,
      value: statistics(5, 4, 3, [3, 6, 9, 18]),
    });
    expect(calculate(original)).toEqual({
      success: true,
      value: statistics(5, 8, 3, [3, 6, 9, 18]),
    });
    // Both declared targets accept generic effects, regardless of the creature's identity.
    const character = loadFixtures().character;
    expect(
      calculate(character, [entryFixture([multiplyEffect(), multiplyEffect('toughnessBonus')])]),
    ).toEqual({ success: true, value: statistics(8, 6, 3, [3, 6, 9, 18]) });
  });

  it.each([
    ['unsupported target', [entryFixture([multiplyEffect('agilityBonus')])], 'INVALID_MODIFIER'],
    [
      'conflicting target',
      [entryFixture([multiplyEffect(), multiplyEffect()])],
      'MODIFIER_CONFLICT',
    ],
  ])('rejects %s without partial results or mutation and recovers', (_name, entries, code) => {
    const instance = loadFixtures().monster;
    const template = resolvedTemplate(instance);
    const before = structuredClone({ instance, template, entries });
    const valid = calculate(instance);
    const result = calculateWithEntries(
      template,
      { document: 'values', value: instance.values },
      { document: 'entries', value: entries },
    );
    expect(result).toMatchObject({
      success: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code, document: 'entries' })]),
    });
    expect(result).not.toHaveProperty('value');
    expect({ instance, template, entries }).toEqual(before);
    // A rejected calculation must leave valid caller data usable on the next attempt.
    expect(calculate(instance)).toEqual(valid);
  });

  it('rejects an unavailable exact version instead of falling back', () => {
    const instance = loadFixtures().character;
    const result = resolveDefinitions(
      runtimeCatalog(),
      {
        system: instance.system,
        template: { ...instance.template, version: '9.0.0' },
      },
      'request',
    );
    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        expect.objectContaining({
          code: 'UNSUPPORTED_DEFINITION_VERSION',
          pointer: '/template',
        }),
      ],
    });
    expect(result).not.toHaveProperty('value');
  });
});
