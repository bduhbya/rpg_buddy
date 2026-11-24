import type { Ref } from 'react';
import type { Entry, Instance } from '../domain/definitions/document-models';
import {
  isRogueTraderRulebookEntryId,
  ROGUE_TRADER_RULEBOOK_ENTRIES,
} from '../shared/rogue-trader-rulebook-entries';
import { RulebookEntryPicker, SheetEntryRemoval, SheetValueEditor } from './sheet-edit-controls';
import type { SheetEditor } from './sheet-edit-controls';
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
  editor?: SheetEditor;
  modifierTargets?: readonly string[];
}

// Render a snapshot field with its label and units, even when its recorded value is zero.
function renderField(
  sheet: Instance,
  id: string,
  editor?: SheetEditor,
  abbreviation?: string,
  reference?: string,
) {
  const source = Object.hasOwn(sheet.values, id);
  const value = source
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
        {editor && source ? (
          <SheetValueEditor
            editor={editor}
            field={`value:${id}`}
            label={label}
            value={value}
            toOperation={(text) =>
              text.trim() && Number.isFinite(Number(text)) ? ['set-value', id, Number(text)] : null
            }
          />
        ) : (
          value
        )}
        {unit && <small> {unit}</small>}
        {reference && <small className="rogue-trader-sheet__movement-reference">{reference}</small>}
      </dd>
    </div>
  );
}

// Omit empty groups and retain the descriptions and sources recorded on the sheet.
function renderEntries(title: string, entries: Entry[], editor: SheetEditor | undefined) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul className="rogue-trader-sheet__entries">
        {entries.map((entry) => (
          <li key={entry.id}>
            <h3>{entry.label}</h3>
            <small>{entry.category}</small>
            {entry.description && <p>{entry.description}</p>}
            {entry.source && <p>Source {entry.source}</p>}
            {editor && <SheetEntryRemoval editor={editor} entryId={entry.id} label={entry.label} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Show the supported Rogue Trader sheet fields in rulebook order using a validated snapshot.
 * @param props The sheet snapshot and optional focus target for navigation.
 * @returns The shared layout with optional controls for source fields and entries.
 */
export function RogueTraderSheet({
  sheet,
  headingRef,
  headingDescriptionId,
  editor,
  modifierTargets = [],
}: RogueTraderSheetProps) {
  const characteristics = CHARACTERISTICS.map(({ field, bonus }) => {
    const score = renderField(sheet, field, editor);
    const recordedBonus = bonus ? renderField(sheet, bonus.id, editor, bonus.abbreviation) : null;
    return score || recordedBonus ? (
      <dl className="rogue-trader-sheet__characteristic" key={field}>
        {recordedBonus}
        {score}
      </dl>
    ) : null;
  });
  // The printed multipliers are reference labels. The numbers come from the snapshot.
  const movement = MOVEMENT.map(({ id, multiplier }) =>
    renderField(sheet, id, editor, undefined, `(AB x ${multiplier})`),
  );
  const skills = sheet.entries.filter(({ category }) => category === 'skill');
  const talentsAndTraits = sheet.entries.filter(
    ({ category }) => category === 'talent' || category === 'trait',
  );
  const otherEntries = sheet.entries.filter(
    ({ category }) => category !== 'skill' && category !== 'talent' && category !== 'trait',
  );
  const availableEntries = Object.keys(ROGUE_TRADER_RULEBOOK_ENTRIES)
    .filter(isRogueTraderRulebookEntryId)
    .filter(
      (id) =>
        !sheet.entries.some((entry) => entry.id === id) &&
        ROGUE_TRADER_RULEBOOK_ENTRIES[id].effects.every(({ target }) =>
          modifierTargets.includes(target),
        ),
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
                {editor ? (
                  <span className="sheet-edit-heading">{sheet.displayName}</span>
                ) : (
                  sheet.displayName
                )}
              </h1>
              {editor && (
                <SheetValueEditor
                  editor={editor}
                  field="name"
                  label="Character name"
                  value={sheet.displayName}
                  toOperation={(text) => ['set-display-name', text]}
                />
              )}
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{sheet.role === 'character' ? 'Character' : 'Monster'}</dd>
          </div>
          <div>
            <dt>Career path</dt>
            <dd>
              {editor ? (
                <SheetValueEditor
                  editor={editor}
                  field="career"
                  label="Career path"
                  value={sheet.career ?? ''}
                  toOperation={(text) => ['set-career', text === '' ? null : text]}
                />
              ) : (
                sheet.career
              )}
            </dd>
          </div>
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
          {renderEntries('Skills', skills, editor)}
          {renderEntries('Talents & Traits', talentsAndTraits, editor)}
          {renderEntries('Other entries', otherEntries, editor)}
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
              {additional.map((field) => renderField(sheet, field, editor))}
            </dl>
          </section>
        ) : null;
      })}
      {editor && sheet.system.id === 'rogue-trader' && (
        <RulebookEntryPicker editor={editor} availableIds={availableEntries} />
      )}
    </article>
  );
}
