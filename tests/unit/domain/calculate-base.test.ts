import { expect, it } from 'vitest';
import { calculateBase } from '../../../src/domain/calculate-base';
import { loadFixtures } from './fixtures';

it('calculateBase returns base-only results for an instance with authored effects', () => {
  const { template, monster } = loadFixtures();
  expect(monster.entries.length).toBeGreaterThan(0);
  expect(
    calculateBase(
      { document: 'template', value: template },
      { document: 'values', value: monster.values },
    ),
  ).toEqual({
    success: true,
    value: {
      strengthBonus: 5,
      toughnessBonus: 4,
      agilityBonus: 3,
      halfMove: 3,
      fullMove: 6,
      chargeMove: 9,
      runMove: 18,
    },
  });
});
