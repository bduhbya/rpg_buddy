import { useEffect, useId, useRef, useState } from 'react';
import {
  isRogueTraderRulebookEntryId,
  ROGUE_TRADER_RULEBOOK_CATEGORIES,
  ROGUE_TRADER_RULEBOOK_ENTRIES,
  ROGUE_TRADER_RULEBOOK_SUMMARIES,
} from '../shared/rogue-trader-rulebook-entries';
import type { RogueTraderRulebookEntryId } from '../shared/rogue-trader-rulebook-entries';
import type { SheetEditOperation } from '../shared/sheet-editing-contract';

const LEADING_ZERO_PATTERN = /^([+-]?)0+(?=[0-9])/;

export interface SheetDraft {
  label: string;
  focusId: string;
  operation: SheetEditOperation | null;
  text?: string;
}

export interface SheetEditor {
  drafts: ReadonlyMap<string, SheetDraft>;
  error?: { key: string; message: string };
  busy: boolean;
  setDraft(key: string, draft: SheetDraft | undefined): void;
}

interface ValueEditorProps {
  editor: SheetEditor;
  field: string;
  label: string;
  value: string | number;
  toOperation(value: string): SheetEditOperation | null;
}

/**
 * Replace a displayed value in place with a keyboard-operable draft control.
 * @param props Editor state, the field's current value, and the mapping to a domain operation.
 * @returns The input that contributes to the sheet's pending edits.
 */
export function SheetValueEditor({ editor, field, label, value, toOperation }: ValueEditorProps) {
  const id = useId();
  const draft = editor.drafts.get(field);
  const invalid = editor.error?.key === field;
  return (
    <div className="sheet-edit-value">
      <input
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'sheet-edit-error' : undefined}
        inputMode={typeof value === 'number' ? 'decimal' : undefined}
        value={draft?.text ?? String(value)}
        readOnly={editor.busy}
        onChange={({ target: { value: input } }) => {
          const text =
            typeof value === 'number' ? input.trim().replace(LEADING_ZERO_PATTERN, '$1') : input;
          const operation = toOperation(text);
          const unchanged =
            text === String(value) || (operation?.[0] === 'set-value' && operation[2] === value);
          editor.setDraft(field, unchanged ? undefined : { label, focusId: id, text, operation });
        }}
      />
    </div>
  );
}

/**
 * Stage the removal of an entry already on the sheet.
 * @param props Draft controls and the entry's stable ID and label.
 * @returns A button to mark or undo the pending removal.
 */
export function SheetEntryRemoval({
  editor,
  entryId,
  label,
}: {
  editor: SheetEditor;
  entryId: string;
  label: string;
}) {
  const id = useId();
  const key = `remove-entry:${entryId}`;
  const removed = editor.drafts.has(key);
  return (
    <button
      type="button"
      id={id}
      disabled={editor.busy}
      aria-describedby={editor.error?.key === key ? 'sheet-edit-error' : undefined}
      onClick={() =>
        editor.setDraft(
          key,
          removed
            ? undefined
            : {
                label,
                focusId: id,
                operation: ['remove-entry', entryId],
              },
        )
      }
    >
      {removed ? `Undo removal of ${label}` : `Remove ${label}`}
    </button>
  );
}

/**
 * Filter rulebook entries by category and name and stage selected entries.
 * @param props Shared draft controls and the catalog IDs supported by the current sheet.
 * @returns The filter controls, results dropdown, and pending additions.
 */
export function RulebookEntryPicker({
  editor,
  availableIds,
}: {
  editor: SheetEditor;
  availableIds: RogueTraderRulebookEntryId[];
}) {
  const id = useId();
  const results = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(ROGUE_TRADER_RULEBOOK_CATEGORIES[0].id);
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const pending = [...editor.drafts].flatMap(([key, { operation }]) =>
    operation?.[0] === 'add-rulebook-entry'
      ? [{ key, entry: ROGUE_TRADER_RULEBOOK_ENTRIES[operation[1]] }]
      : [],
  );
  const invalid = pending.some(({ key }) => key === editor.error?.key);
  const available = availableIds.filter((entryId) => {
    const { category: entryCategory } = ROGUE_TRADER_RULEBOOK_ENTRIES[entryId];
    return entryCategory === category && !editor.drafts.has(`add-rulebook-entry:${entryId}`);
  });
  const search = query.trim().toLowerCase();
  const matches = available.filter((entryId) =>
    ROGUE_TRADER_RULEBOOK_ENTRIES[entryId].label.toLowerCase().includes(search),
  );
  const selected = isRogueTraderRulebookEntryId(choice) && available.includes(choice) ? choice : '';
  const active = open ? matches[activeIndex] : undefined;
  const activeId = active ? `${id}-option-${active}` : undefined;
  const listId = `${id}-results`;

  // Keep the highlighted result in view while DOM focus stays on the search input.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  // Closing clears the search while preserving the last explicitly selected entry.
  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }

  // Choose a result without adding a sheet draft.
  function choose(entryId: RogueTraderRulebookEntryId) {
    setChoice(entryId);
    close();
    results.current?.focus();
  }

  // Keep browsing the dropdown separate from explicitly staging a selection.
  function addSelection() {
    if (!selected || editor.busy) return;
    editor.setDraft(`add-rulebook-entry:${selected}`, {
      label: ROGUE_TRADER_RULEBOOK_ENTRIES[selected].label,
      focusId: id,
      operation: ['add-rulebook-entry', selected],
    });
    setChoice('');
    results.current?.focus();
  }

  return (
    <fieldset className="sheet-edit-picker" disabled={editor.busy}>
      <legend>Add rulebook entries</legend>
      <label>
        Category
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setChoice('');
            close();
          }}
        >
          {ROGUE_TRADER_RULEBOOK_CATEGORIES.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="sheet-edit-combobox">
        <label htmlFor={id}>Rulebook entry</label>
        <input
          id={id}
          ref={results}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeId}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'sheet-edit-error' : undefined}
          placeholder="Search rulebook entries"
          value={open ? query : selected ? ROGUE_TRADER_RULEBOOK_ENTRIES[selected].label : ''}
          onClick={() => setOpen(true)}
          onBlur={close}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              const direction = event.key === 'ArrowDown' ? 1 : -1;
              setActiveIndex((index) =>
                index < 0
                  ? direction === 1
                    ? 0
                    : matches.length - 1
                  : Math.max(0, Math.min(index + direction, matches.length - 1)),
              );
            } else if (event.key === 'Enter' && (active || !open)) {
              event.preventDefault();
              if (active) choose(active);
              else setOpen(true);
            } else if (event.key === 'Escape' && open) {
              event.preventDefault();
              close();
            }
          }}
        />
        {open && (
          <div className="sheet-edit-combobox__popup">
            <ul id={listId} role="listbox" aria-label="Rulebook matches">
              {matches.map((entryId) => (
                <li
                  key={entryId}
                  id={`${id}-option-${entryId}`}
                  role="option"
                  aria-selected={active === entryId}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(entryId)}
                >
                  <span>{ROGUE_TRADER_RULEBOOK_ENTRIES[entryId].label}</span>{' '}
                  <small>{ROGUE_TRADER_RULEBOOK_SUMMARIES[entryId]}</small>
                </li>
              ))}
            </ul>
            {matches.length === 0 && <p role="status">No matching entries</p>}
          </div>
        )}
      </div>
      <button type="button" disabled={!selected || open} onClick={addSelection}>
        Stage entry
      </button>
      {pending.length > 0 && (
        <ul className="sheet-edit-pending" aria-label="Pending rulebook entries">
          {pending.map(({ key, entry }) => (
            <li key={key}>
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
              <p>{entry.source}</p>
              <button
                type="button"
                aria-label={`Undo adding ${entry.label}`}
                onClick={() => {
                  editor.setDraft(key, undefined);
                  results.current?.focus();
                }}
              >
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
