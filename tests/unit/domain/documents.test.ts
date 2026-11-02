import { expect, test } from 'vitest';
import { loadFixtures } from './fixtures';

test('both instance roles reference the same exact manifest and creature template', () => {
  const { manifest, template, character, monster } = loadFixtures();
  expect({ id: manifest.id, version: manifest.version }).toEqual({
    id: 'rogue-trader',
    version: '1.0.0',
  });
  expect(manifest.templates).toEqual([{ id: 'creature-core', version: '1.0.0' }]);
  expect(template.system).toEqual({ id: manifest.id, version: manifest.version });
  for (const instance of [character, monster]) {
    expect(instance.system).toEqual(template.system);
    expect(instance.template).toEqual({ id: template.id, version: template.version });
    expect(instance.entityType).toBe('creature');
  }
  expect(character.role).toBe('character');
  expect(monster.role).toBe('monster');
  expect(character.id).not.toBe(monster.id);
});

test('template declares ordered inputs, zero defaults and derived syntax without persisted results', () => {
  const { template, character, monster } = loadFixtures();
  const inputIds = [
    'weaponSkill',
    'ballisticSkill',
    'strength',
    'toughness',
    'agility',
    'intelligence',
    'perception',
    'willpower',
    'fellowship',
  ];
  expect(template.entityType).toBe('creature');
  expect(template.inputs.map((field) => field.id)).toEqual(inputIds);
  expect(template.inputs.map((field) => field.default)).toEqual(Array(9).fill(0));
  expect(template.sections.map((section) => section.id)).toEqual([
    'characteristics',
    'bonuses',
    'movement',
  ]);
  expect(template.derived.map((field) => field.id)).toEqual([
    'strengthBonus',
    'toughnessBonus',
    'agilityBonus',
    'halfMove',
    'fullMove',
    'chargeMove',
    'runMove',
  ]);
  expect(template.derived.find((field) => field.id === 'toughnessBonus')?.expression).toEqual({
    op: 'floor',
    value: {
      op: 'divide',
      left: { op: 'field', id: 'toughness' },
      right: { op: 'constant', value: 10 },
    },
  });
  for (const instance of [character, monster]) {
    expect(Object.keys(instance.values).sort()).toEqual([...inputIds].sort());
  }
  expect(character.values.strength).toBe(41);
  expect(monster.values.strength).toBe(50);
});

test('the monster owns its explicit effect while the shared template stays generic', () => {
  const { template, character, monster } = loadFixtures();
  expect(template.modifierTargets).toEqual(['strengthBonus', 'toughnessBonus']);
  expect(character.entries).toEqual([]);
  expect(monster.entries).toHaveLength(1);
  expect(monster.entries[0].effects).toEqual([
    { op: 'multiply', target: 'toughnessBonus', factor: 2 },
  ]);
  expect(monster.entries[0].source).toContain('printed pp. 368 and 377');
  expect(character.metadata).toBeUndefined();
  expect(monster.entries[0].metadata?.sourceRegisterRefs).toEqual(['S6', 'S7']);
});

test('each fixture load is independent of mutations in another test', () => {
  const first = loadFixtures();
  first.character.values.strength = 0;
  first.monster.entries[0].effects[0].factor = 3;
  first.template.inputs[0].default = 99;
  const second = loadFixtures();
  expect(second.character.values.strength).toBe(41);
  expect(second.monster.entries[0].effects[0].factor).toBe(2);
  expect(second.template.inputs[0].default).toBe(0);
});
