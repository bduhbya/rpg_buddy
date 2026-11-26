import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { Instance } from '../domain/definitions/document-models';
import { sameInstanceContent } from '../domain/instances/same-instance-content';
import type {
  SheetEditHandle,
  SheetEditPreviewRequest,
  SheetEditResult,
} from '../shared/sheet-editing-contract';
import type { SheetSaveDestination, SheetSavingResult } from '../shared/sheet-saving-contract';
import type { SheetDraft, SheetEditor } from './sheet-edit-controls';
import type { SheetView } from './sheet-view';
import { RogueTraderSheet } from './rogue-trader-sheet';

interface EditableSheetProps {
  view: SheetView;
  heading: Ref<HTMLHeadingElement>;
  back(): void;
  onSaved(): void;
}

// Give the user a next step for bridge failures and preserve actionable persistence diagnostics.
function saveFailure(result: Extract<SheetSavingResult, { ok: false }>): string {
  if (result.diagnostics?.length) return result.diagnostics.map(({ message }) => message).join(' ');
  switch (result.code) {
    case 'STALE_SHEET':
      return 'This sheet is no longer available for saving. Return to the main page and open or create it again.';
    case 'INVALID_DESTINATION':
      return 'That save location is no longer available. Choose a current library location and retry.';
    case 'BUSY':
      return 'Another save is in progress. Wait for it to finish, then retry.';
    default:
      return 'The save service is unavailable. Try again.';
  }
}

// Keep invalid or unavailable previews actionable through the ordinary edit workflow.
async function previewDrafts(
  handle: SheetEditHandle,
  drafts: ReadonlyMap<string, SheetDraft>,
): Promise<boolean> {
  const operations: SheetEditPreviewRequest['operations'] = [];
  for (const { operation } of drafts.values()) {
    if (!operation || operation[0] === 'discard-changes') return true;
    operations.push(operation);
  }
  try {
    const result = await window.rpgBuddy.previewSheetEdits({ ...handle, operations });
    return !result.ok || result.hasChanges;
  } catch {
    return true;
  }
}

/**
 * Manage drafts and send explicit edits while displaying the same sheet in both modes.
 * @param props The initial view, navigation focus target, Back action, and save notification.
 * @returns The sheet page and its mode controls.
 */
export function EditableSheet({ view, heading, back, onSaved }: EditableSheetProps) {
  const [sheet, setSheet] = useState(view.sheet);
  const handle = useRef(view.editHandle);
  const [editing, setEditing] = useState(Boolean(view.startEditing && view.editHandle));
  const [drafts, setDrafts] = useState(() => new Map<string, SheetDraft>());
  const [error, setError] = useState<SheetEditor['error']>();
  const [status, setStatus] = useState('');
  const [activity, setActivity] = useState<'apply' | 'save' | 'discard' | 'check'>();
  const busy = activity !== undefined;
  const [destinations, setDestinations] = useState<SheetSaveDestination[]>([]);
  const [destinationId, setDestinationId] = useState('');
  const [listing, setListing] = useState(Boolean(view.editHandle));
  const [destinationIssue, setDestinationIssue] = useState('');
  const [destinationAttempt, setDestinationAttempt] = useState(0);
  const [saveIssue, setSaveIssue] = useState('');
  const pending = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const [baseline, setBaseline] = useState(view.sheet);
  const [hasSaved, setHasSaved] = useState(false);
  const [preview, setPreview] = useState<{
    drafts: typeof drafts;
    sheet: Instance;
    hasChanges: boolean;
  }>();
  const pendingChanges =
    preview?.drafts === drafts && preview.sheet === sheet ? preview.hasChanges : undefined;
  const hasChanges = drafts.size ? pendingChanges : !sameInstanceContent(sheet, baseline);
  const canSave = Boolean(destinationId) && !listing && !busy && (!hasSaved || hasChanges === true);
  const unsavedDialog = useRef<HTMLDialogElement>(null);
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

  // Refresh choices on entry and retry, using the latest revision and ignoring obsolete replies.
  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      if (!active || !handle.current) return;
      try {
        const result = await window.rpgBuddy.sheetSaving({ ...handle.current, action: 'list' });
        if (!active) return;
        if (result.ok && result.action === 'list' && result.destinations.length) {
          setDestinations(result.destinations);
          setHasSaved(result.hasSaved);
          setDestinationId(result.destinations[0].id);
        } else {
          setDestinationIssue(result.ok ? 'No save locations are available.' : saveFailure(result));
        }
      } catch {
        if (active) setDestinationIssue('Save locations could not be loaded. Try again.');
      } finally {
        if (active) setListing(false);
      }
    });
    return () => {
      active = false;
    };
  }, [destinationAttempt]);

  // Ignore late replies after a draft or authoritative revision changes.
  useEffect(() => {
    if (!editing || busy || !drafts.size || !handle.current) return;
    let current = true;
    const revision = handle.current;
    queueMicrotask(async () => {
      if (!current) return;
      const hasChanges = await previewDrafts(revision, drafts);
      if (current) setPreview({ drafts, sheet, hasChanges });
    });
    return () => {
      current = false;
    };
  }, [busy, drafts, editing, sheet]);

  // Retry location discovery after transport failure or a destination change.
  function reloadDestinations() {
    setDestinations([]);
    setDestinationId('');
    setDestinationIssue('');
    setListing(true);
    setDestinationAttempt((attempt) => attempt + 1);
  }

  // Keep unsubmitted drafts together for the sheet-level actions.
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

  // Keep the view and its originating workflow on the same authoritative revision.
  function acceptEdit(result: Extract<SheetEditResult, { ok: true }>) {
    handle.current = result.editHandle;
    setSheet(result.sheet);
    view.onEdit?.(result);
  }

  // Send edits serially so every accepted change advances the authoritative revision.
  async function applyDrafts(revision: SheetEditHandle): Promise<Instance | undefined> {
    let updated = sheet;
    for (const [key, draft] of drafts) {
      const operation = draft.operation;
      if (!operation) {
        focusId.current = draft.focusId;
        setError({ key, message: `${draft.label}: Enter a valid number.` });
        return undefined;
      }
      try {
        const result = await window.rpgBuddy.editSheet({ ...revision, operation });
        if (!result.ok) {
          focusId.current = draft.focusId;
          const detail =
            result.diagnostics?.map(({ message }) => message).join(' ') ??
            (result.code === 'STALE_SHEET'
              ? 'This sheet is no longer available for editing. Return to the main page and open or create it again.'
              : 'The edit could not be applied. Try again.');
          setError({ key, message: `${draft.label}: ${detail}` });
          return undefined;
        }
        revision = result.editHandle;
        acceptEdit(result);
        updated = result.sheet;
        setDrafts((current) => {
          const next = new Map(current);
          next.delete(key);
          return next;
        });
      } catch {
        focusId.current = draft.focusId;
        setError({ key, message: `${draft.label}: The edit service is unavailable. Try again.` });
        return undefined;
      }
    }
    return updated;
  }

  // Hold the same action guard from the first draft through the final save result.
  async function submit(action: 'apply' | 'save' | 'save-and-done' | 'discard') {
    const saving = action === 'save' || action === 'save-and-done';
    if (pending.current || !handle.current || (saving && !canSave)) return;
    pending.current = true;
    setActivity(saving ? 'save' : action === 'discard' ? 'discard' : 'apply');
    setError(undefined);
    setSaveIssue('');
    setStatus('');
    try {
      if (action === 'discard') {
        if (!sameInstanceContent(sheet, baseline)) {
          const result = await window.rpgBuddy.editSheet({
            ...handle.current,
            operation: ['discard-changes'],
          });
          if (!result.ok) {
            setSaveIssue('The changes could not be discarded. Try again.');
            return;
          }
          acceptEdit(result);
        }
        setDrafts(new Map());
        setStatus('Changes discarded.');
        leaveEditMode();
        return;
      }
      const updated = await applyDrafts(handle.current);
      if (!updated) return;
      if (saving) {
        try {
          const result = await window.rpgBuddy.sheetSaving({
            ...handle.current,
            action: 'save',
            destinationId,
          });
          if (!result.ok) {
            setSaveIssue(saveFailure(result));
            if (result.code === 'INVALID_DESTINATION') reloadDestinations();
            return;
          }
          setBaseline(updated);
          setHasSaved(true);
          setStatus('Sheet saved.');
          onSaved();
          if (action === 'save-and-done') leaveEditMode();
        } catch {
          setSaveIssue('The save service is unavailable. Try again.');
        }
        return;
      }
      if (drafts.size) setStatus('Changes applied.');
    } catch {
      setSaveIssue(
        action === 'discard'
          ? 'The changes could not be discarded. Try again.'
          : 'The edit service is unavailable. Try again.',
      );
    } finally {
      pending.current = false;
      setActivity(undefined);
    }
  }

  // Restore focus to Edit when returning to the view mode of the current revision.
  function leaveEditMode() {
    focusMode.current = true;
    setEditing(false);
  }

  // Ask how to handle changes before leaving the editing session.
  async function finish() {
    if (pending.current || !handle.current) return;
    let changed = hasChanges;
    if (changed === undefined) {
      pending.current = true;
      setActivity('check');
      changed = await previewDrafts(handle.current, drafts);
      setPreview({ drafts, sheet, hasChanges: changed });
      pending.current = false;
      setActivity(undefined);
    }
    if (changed) unsavedDialog.current?.showModal();
    else if (drafts.size) void submit('discard');
    else leaveEditMode();
  }

  // Close the prompt before submitting so validation can focus the affected sheet field.
  function confirmExit(action: 'save-and-done' | 'discard') {
    unsavedDialog.current?.close();
    void submit(action);
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
          <button type="button" aria-disabled={busy} onClick={() => !pending.current && back()}>
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
                  if (drafts.size) void submit('apply');
                }}
              >
                Apply edits
              </button>
              <button type="button" aria-disabled={busy || !drafts.size} onClick={discardDrafts}>
                Discard edits
              </button>
              <button type="button" aria-disabled={!canSave} onClick={() => void submit('save')}>
                Save
              </button>
            </div>
          ) : (
            <button
              ref={editButton}
              type="button"
              aria-disabled={busy}
              onClick={() => {
                if (pending.current) return;
                focusMode.current = true;
                setStatus('');
                setEditing(true);
              }}
            >
              Edit
            </button>
          ))}
        {editing && (
          <div className="sheet-page__save-controls" role="group" aria-label="Sheet saving actions">
            <label htmlFor="sheet-save-location">Save location</label>
            <select
              id="sheet-save-location"
              value={destinationId}
              disabled={listing || busy || !destinations.length}
              onChange={(event) => setDestinationId(event.currentTarget.value)}
            >
              {!destinations.length && <option value="">Unavailable</option>}
              {destinations.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            {destinationIssue && (
              <button type="button" onClick={reloadDestinations}>
                Reload save locations
              </button>
            )}
          </div>
        )}
        {handle.current && (
          <div className="sheet-page__edit-feedback">
            <p className="sheet-page__feedback" role="status">
              {activity === 'save'
                ? 'Saving sheet…'
                : activity === 'apply'
                  ? 'Applying changes…'
                  : activity === 'discard'
                    ? 'Discarding changes…'
                    : activity === 'check'
                      ? 'Checking edits…'
                      : editing && listing
                        ? 'Loading save locations…'
                        : status}
            </p>
            <p
              className="sheet-page__feedback sheet-page__error"
              role="alert"
              id="sheet-edit-error"
            >
              {error?.message || saveIssue || (editing ? destinationIssue : undefined)}
            </p>
          </div>
        )}
      </div>
      <dialog
        ref={unsavedDialog}
        className="sheet-page__unsaved-dialog"
        aria-labelledby="sheet-unsaved-title"
        aria-describedby="sheet-unsaved-description"
      >
        <h2 id="sheet-unsaved-title">Save changes?</h2>
        <p id="sheet-unsaved-description">You have unsaved changes to this sheet.</p>
        <div className="sheet-page__edit-buttons">
          <button type="button" autoFocus onClick={() => unsavedDialog.current?.close()}>
            Keep editing
          </button>
          <button type="button" onClick={() => confirmExit('discard')}>
            Discard changes
          </button>
          <button type="button" disabled={!canSave} onClick={() => confirmExit('save-and-done')}>
            Save and finish
          </button>
        </div>
      </dialog>
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
