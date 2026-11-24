import type { Entry } from '../domain/definitions/document-models';

export const ROGUE_TRADER_RULEBOOK_CATEGORIES = [
  { id: 'trait', label: 'Traits' },
  { id: 'talent', label: 'Talents' },
];

// Fixed selections from the reviewed Unnatural Characteristic rules on printed page 368.
// TODO: Replace this temporary list with a file-based rulebook library lookup.
export const ROGUE_TRADER_RULEBOOK_ENTRIES = {
  'unnatural-strength': {
    id: 'unnatural-strength',
    label: 'Unnatural Strength (x2)',
    category: 'trait',
    description:
      'Double the Strength Bonus after calculating it from the Strength score. For example, Strength 45 gives a base bonus of 4 and a modified bonus of 8. The Strength score and Movement stay the same.',
    source: 'Rogue Trader Core Rulebook (2009, RT01, Print ID 01), printed p. 368.',
    effects: [{ op: 'multiply', target: 'strengthBonus', factor: 2 }],
  },
  'unnatural-toughness': {
    id: 'unnatural-toughness',
    label: 'Unnatural Toughness (x2)',
    category: 'trait',
    description:
      'Double the Toughness Bonus after calculating it from the Toughness score. For example, Toughness 45 gives a base bonus of 4 and a modified bonus of 8. The Toughness score and Movement stay the same.',
    source: 'Rogue Trader Core Rulebook (2009, RT01, Print ID 01), printed pp. 368 and 377.',
    effects: [{ op: 'multiply', target: 'toughnessBonus', factor: 2 }],
  },
} satisfies Record<string, Entry>;

export type RogueTraderRulebookEntryId = keyof typeof ROGUE_TRADER_RULEBOOK_ENTRIES;

export const ROGUE_TRADER_RULEBOOK_SUMMARIES: Record<RogueTraderRulebookEntryId, string> = {
  'unnatural-strength': 'Doubles Strength Bonus',
  'unnatural-toughness': 'Doubles Toughness Bonus',
};

/**
 * Check an ID before using it to retrieve a supported rulebook entry.
 * @param value Candidate ID.
 * @returns Whether the ID identifies a supported entry.
 */
export function isRogueTraderRulebookEntryId(value: unknown): value is RogueTraderRulebookEntryId {
  return typeof value === 'string' && Object.hasOwn(ROGUE_TRADER_RULEBOOK_ENTRIES, value);
}
