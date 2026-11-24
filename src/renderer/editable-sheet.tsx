import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { SheetDraft, SheetEditor } from './sheet-edit-controls';
import type { SheetView } from './sheet-view';
import { RogueTraderSheet } from './rogue-trader-sheet';

interface EditableSheetProps {
  view: SheetView;
  heading: Ref<HTMLHeadingElement>;
  back(): void;
}

/**
 * Manage drafts and send explicit edits while displaying the same sheet in both modes.
 * @param props The initial view, navigation focus target, and Back action.
 * @returns The sheet page and its mode controls.
 */
export function EditableSheet({ view, heading, back }: EditableSheetProps) {
  const [sheet, setSheet] = useState(view.sheet);
  const handle = useRef(view.editHandle);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState(() => new Map<string, SheetDraft>());
  const [error, setError] = useState<SheetEditor['error']>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const focusMode = useRef(false);
  const focusId = useRef<string>(undefined);

  // Move focus after mode changes and report a rejected draft at its input.
  useEffect(() => {
    if (busy) return;
    if (focusId.current) {
      const fallback = doneButton.current;
      const target = document.getElementById(focusId.current) ?? fallback;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
      focusId.current = undefined;
    } else if (focusMode.current) {
      (editing ? doneButton : editButton).current?.focus();
      focusMode.current = false;
    }
  }, [busy, editing, error, sheet]);

  // Keep unsubmitted drafts together for the sheet-level actions and a future Save.
  function setDraft(key: string, draft: SheetDraft | undefined) {
    if (pending.current) return;
    setDrafts((current) => {
      const next = new Map(current);
      if (draft) next.set(key, draft);
      else next.delete(key);
      return next;
    });
    if (error?.key === key) setError(undefined);
  }

  // Send operations serially so every accepted change uses the new authoritative revision.
  async function submit(): Promise<boolean> {
    if (pending.current || !handle.current) return false;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setStatus('');
    try {
      for (const [key, draft] of drafts) {
        const operation = draft.operation;
        if (!operation) {
          focusId.current = draft.focusId;
          setError({ key, message: `${draft.label}: Enter a valid number.` });
          return false;
        }
        try {
          const result = await window.rpgBuddy.editSheet({ ...handle.current, operation });
          if (!result.ok) {
            focusId.current = draft.focusId;
            const detail =
              result.diagnostics?.map(({ message }) => message).join(' ') ??
              (result.code === 'STALE_SHEET'
                ? 'This sheet is no longer available for editing. Return to the main page and open or create it again.'
                : 'The edit could not be applied. Try again.');
            setError({ key, message: `${draft.label}: ${detail}` });
            return false;
          }
          handle.current = result.editHandle;
          setSheet(result.sheet);
          view.onEdit?.(result);
          setDrafts((current) => {
            const next = new Map(current);
            next.delete(key);
            return next;
          });
        } catch {
          focusId.current = draft.focusId;
          setError({ key, message: `${draft.label}: The edit service is unavailable. Try again.` });
          return false;
        }
      }
      if (drafts.size) setStatus('Changes applied.');
      return true;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  // Finish only once every pending operation has succeeded.
  async function finish() {
    if (!(await submit())) return;
    focusMode.current = true;
    setEditing(false);
  }

  // Reset pending drafts while preserving already applied edits and staying in edit mode.
  function discardDrafts() {
    if (pending.current || !drafts.size) return;
    setDrafts(new Map());
    setError(undefined);
    setStatus('Unapplied changes discarded.');
  }

  const editor: SheetEditor | undefined = editing
    ? {
        drafts,
        error,
        busy,
        setDraft,
      }
    : undefined;

  return (
    <main className="sheet-page">
      <div
        className={
          editing ? 'sheet-page__actions sheet-page__actions--sticky' : 'sheet-page__actions'
        }
      >
        {!editing && (
          <button type="button" onClick={back}>
            Back to main page
          </button>
        )}
        {handle.current &&
          (editing ? (
            <div
              className="sheet-page__edit-buttons"
              role="group"
              aria-label="Sheet editing actions"
            >
              <button
                ref={doneButton}
                type="button"
                aria-disabled={busy}
                onClick={() => void finish()}
              >
                Done
              </button>
              <button
                type="button"
                aria-disabled={busy || !drafts.size}
                onClick={() => {
                  if (drafts.size) void submit();
                }}
              >
                Apply edits
              </button>
              <button type="button" aria-disabled={busy || !drafts.size} onClick={discardDrafts}>
                Discard edits
              </button>
            </div>
          ) : (
            <button
              ref={editButton}
              type="button"
              onClick={() => {
                focusMode.current = true;
                setStatus('');
                setEditing(true);
              }}
            >
              Edit
            </button>
          ))}
        {handle.current && (
          <div className="sheet-page__edit-feedback">
            <p className="sheet-page__feedback" role="status">
              {busy ? 'Applying changes…' : status}
            </p>
            <p
              className="sheet-page__feedback sheet-page__error"
              role="alert"
              id="sheet-edit-error"
            >
              {error?.message}
            </p>
          </div>
        )}
      </div>
      {view.readOnlyDetails && (
        <aside className="sheet-page__read-only" aria-label="Read-only sheet">
          <p id="sheet-read-only-note">
            This sheet is read-only because the system or template version it was saved with is
            unavailable.
          </p>
          {view.readOnlyDetails.length > 0 && (
            <ul>
              {view.readOnlyDetails.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </aside>
      )}
      <RogueTraderSheet
        sheet={sheet}
        headingRef={heading}
        headingDescriptionId={view.readOnlyDetails ? 'sheet-read-only-note' : undefined}
        editor={editor}
        modifierTargets={view.modifierTargets}
      />
    </main>
  );
}
