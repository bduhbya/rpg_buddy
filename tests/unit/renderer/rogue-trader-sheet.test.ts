import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import type { Instance } from '../../../src/domain/definitions/document-models';
import { RogueTraderSheet } from '../../../src/renderer/rogue-trader-sheet';

// Load the authored examples used by the desktop workflow tests.
function loadSheet(name: string): Instance {
  const fixture = new URL(
    '../../../data_contracts/examples/v2/' + name + '.instance.json',
    import.meta.url,
  );
  return JSON.parse(readFileSync(fixture, 'utf8')) as Instance;
}

const TERM_PATTERN = /<dt>(.*?)<\/dt>/g;

describe('Rogue Trader sheet', () => {
  test.each([
    ['explorator', 'Character'],
    ['ork-freebooter', 'Monster'],
  ])('presents %s in rulebook field order', (name, role) => {
    const sheet = loadSheet(name);
    const markup = renderToStaticMarkup(createElement(RogueTraderSheet, { sheet }));

    expect(markup).toContain(`tabindex="-1">${sheet.displayName}</h1>`);
    expect(markup).toContain('<dt>Character name</dt>');
    expect(markup).toContain(`<dt>Role</dt><dd>${role}</dd>`);
    expect(markup).toContain(
      `<dt><abbr title="Toughness Bonus">TB</abbr></dt><dd>${sheet.derived.toughnessBonus}</dd>`,
    );
    const labels = Array.from(markup.matchAll(TERM_PATTERN), ([, label]) => label);
    expect(labels.slice(-18)).toEqual([
      'Weapon Skill',
      'Ballistic Skill',
      '<abbr title="Strength Bonus">SB</abbr>',
      'Strength',
      '<abbr title="Toughness Bonus">TB</abbr>',
      'Toughness',
      '<abbr title="Agility Bonus">AB</abbr>',
      'Agility',
      'Intelligence',
      'Perception',
      'Willpower',
      'Fellowship',
      'Half Move',
      'Full Move',
      'Charge',
      'Run',
      'Base Leap',
      'Base Jump',
    ]);
  });

  test('retains recorded values, labels, units, career and entry content', () => {
    const sheet = loadSheet('explorator');
    sheet.career = 'Explorator';
    sheet.derived.toughnessBonus = 17;
    sheet.derived.halfMove = 0.5;
    sheet.values.resolve = 0;
    sheet.presentation.fields.resolve = { label: 'Recorded Resolve' };
    sheet.presentation.sections.push({ id: 'resolve', label: 'Resolve', fields: ['resolve'] });
    sheet.entries = [
      {
        id: 'tech-use',
        category: 'skill',
        label: 'Tech-Use',
        description: 'A recorded skill.',
        source: 'Campaign notes',
        effects: [],
      },
      {
        id: 'resilient',
        category: 'trait',
        label: 'Resilient',
        description: 'A recorded trait.',
        effects: [],
      },
    ];

    const markup = renderToStaticMarkup(createElement(RogueTraderSheet, { sheet }));

    expect(markup).toContain('<dt>Career path</dt><dd>Explorator</dd>');
    expect(markup).toContain('<dt><abbr title="Toughness Bonus">TB</abbr></dt><dd>17</dd>');
    expect(markup).toContain(
      '<dt>Half Move</dt><dd>0.5<small> metres/round</small><small class="rogue-trader-sheet__movement-reference">(AB x 1)</small></dd>',
    );
    expect(markup).toContain('<dt>Recorded Resolve</dt><dd>0</dd>');
    expect(markup).toContain('<dt>Base Leap</dt><dd></dd>');
    expect(markup).toContain('<dt>Base Jump</dt><dd></dd>');
    for (const multiplier of [1, 2, 3, 6]) {
      expect(markup).toContain(`(AB x ${multiplier})`);
    }
    expect(markup).toContain('<h2>Skills</h2>');
    expect(markup).toContain('<h3>Tech-Use</h3>');
    expect(markup).toContain('<p>A recorded skill.</p>');
    expect(markup).toContain('<p>Source Campaign notes</p>');
    expect(markup).toContain('<h2>Talents &amp; Traits</h2>');
    expect(markup).toContain('<h3>Resilient</h3>');
  });
});
