import type { Ref } from 'react';
import type { Entry, Instance } from '../domain/definitions/document-models';
import './rogue-trader-sheet.css';

const CHARACTERISTICS = [
  { field: 'weaponSkill' },
  { field: 'ballisticSkill' },
  { field: 'strength', bonus: { id: 'strengthBonus', abbreviation: 'SB' } },
  { field: 'toughness', bonus: { id: 'toughnessBonus', abbreviation: 'TB' } },
  { field: 'agility', bonus: { id: 'agilityBonus', abbreviation: 'AB' } },
  { field: 'intelligence' },
  { field: 'perception' },
  { field: 'willpower' },
  { field: 'fellowship' },
];

// TODO: Read movement multipliers from the sheet snapshot when it provides them.
const MOVEMENT = [
  { id: 'halfMove', multiplier: 1 },
  { id: 'fullMove', multiplier: 2 },
  { id: 'chargeMove', multiplier: 3 },
  { id: 'runMove', multiplier: 6 },
];
const PLACED_FIELDS = new Set([
  ...CHARACTERISTICS.flatMap(({ field, bonus }) => (bonus ? [field, bonus.id] : [field])),
  ...MOVEMENT.map(({ id }) => id),
]);

interface RogueTraderSheetProps {
  sheet: Instance;
  headingRef?: Ref<HTMLHeadingElement>;
  headingDescriptionId?: string;
}

// Render a snapshot field with its label and units, even when its recorded value is zero.
function renderField(sheet: Instance, id: string, abbreviation?: string, reference?: string) {
  const value = Object.hasOwn(sheet.values, id)
    ? sheet.values[id]
    : Object.hasOwn(sheet.derived, id)
      ? sheet.derived[id]
      : undefined;
  if (value === undefined) return null;
  const { label, unit } = sheet.presentation.fields[id];
  return (
    <div key={id}>
      <dt>{abbreviation ? <abbr title={label}>{abbreviation}</abbr> : label}</dt>
      <dd>
        {value}
        {unit && <small> {unit}</small>}
        {reference && <small className="rogue-trader-sheet__movement-reference">{reference}</small>}
      </dd>
    </div>
  );
}

// Omit empty groups and retain the descriptions and sources recorded on the sheet.
function renderEntries(title: string, entries: Entry[]) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul className="rogue-trader-sheet__entries">
        {entries.map(({ id, category, label, description, source }) => (
          <li key={id}>
            <h3>{label}</h3>
            <small>{category}</small>
            {description && <p>{description}</p>}
            {source && <p>Source {source}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Show the supported Rogue Trader sheet fields in rulebook order using a validated snapshot.
 * @param props The sheet snapshot and optional focus target for navigation.
 * @returns A read-only presentation that uses recorded statistics directly.
 */
export function RogueTraderSheet({
  sheet,
  headingRef,
  headingDescriptionId,
}: RogueTraderSheetProps) {
  const characteristics = CHARACTERISTICS.map(({ field, bonus }) => {
    const score = renderField(sheet, field);
    const recordedBonus = bonus ? renderField(sheet, bonus.id, bonus.abbreviation) : null;
    return score || recordedBonus ? (
      <dl className="rogue-trader-sheet__characteristic" key={field}>
        {recordedBonus}
        {score}
      </dl>
    ) : null;
  });
  // The printed multipliers are reference labels. The numbers come from the snapshot.
  const movement = MOVEMENT.map(({ id, multiplier }) =>
    renderField(sheet, id, undefined, `(AB x ${multiplier})`),
  );
  const skills = sheet.entries.filter(({ category }) => category === 'skill');
  const talentsAndTraits = sheet.entries.filter(
    ({ category }) => category === 'talent' || category === 'trait',
  );
  const otherEntries = sheet.entries.filter(
    ({ category }) => category !== 'skill' && category !== 'talent' && category !== 'trait',
  );

  return (
    <article className="rogue-trader-sheet" aria-labelledby="rogue-trader-sheet-heading">
      <header>
        <p className="eyebrow">Rogue Trader</p>
        <dl className="rogue-trader-sheet__identity">
          <div>
            <dt>Character name</dt>
            <dd>
              <h1
                id="rogue-trader-sheet-heading"
                ref={headingRef}
                tabIndex={-1}
                aria-describedby={headingDescriptionId}
              >
                {sheet.displayName}
              </h1>
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{sheet.role === 'character' ? 'Character' : 'Monster'}</dd>
          </div>
          {sheet.career && (
            <div>
              <dt>Career path</dt>
              <dd>{sheet.career}</dd>
            </div>
          )}
          <div>
            <dt>Sheet ID</dt>
            <dd>{sheet.id}</dd>
          </div>
        </dl>
      </header>

      {characteristics.some(Boolean) && (
        <section>
          <h2>Characteristics</h2>
          <div className="rogue-trader-sheet__characteristics">{characteristics}</div>
        </section>
      )}

      {skills.length + talentsAndTraits.length + otherEntries.length > 0 && (
        <div className="rogue-trader-sheet__entry-groups">
          {renderEntries('Skills', skills)}
          {renderEntries('Talents & Traits', talentsAndTraits)}
          {renderEntries('Other entries', otherEntries)}
        </div>
      )}

      {movement.some(Boolean) && (
        <section>
          <h2>Movement</h2>
          <dl className="rogue-trader-sheet__movement">
            {movement}
            <div>
              <dt>Base Leap</dt>
              <dd />
            </div>
            <div>
              <dt>Base Jump</dt>
              <dd />
            </div>
          </dl>
        </section>
      )}

      {/* Preserve validated fields outside the authored core layout in their snapshot sections. */}
      {sheet.presentation.sections.map(({ id, label, fields }) => {
        const additional = fields.filter((field) => !PLACED_FIELDS.has(field));
        return additional.length > 0 ? (
          <section key={id}>
            <h2>{label}</h2>
            <dl className="rogue-trader-sheet__grid">
              {additional.map((field) => renderField(sheet, field))}
            </dl>
          </section>
        ) : null;
      })}
    </article>
  );
}
