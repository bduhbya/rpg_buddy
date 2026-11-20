import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { INSTANCE_ROLES } from '../domain/definitions/document-models';
import type { InstanceRole } from '../domain/definitions/document-models';
import type { Diagnostic } from '../domain/definitions/diagnostics';
import type { SheetLoadingRequest, SheetLoadingResult } from '../shared/sheet-loading-contract';
import { SheetPreview } from './sheet-preview';

type SheetChoices = Extract<SheetLoadingResult, { ok: true; action: 'list' }>;
type OpenedSheet = Extract<SheetLoadingResult, { ok: true; action: 'open' }>;

interface SheetLoadingPanelProps {
  selectionRevision: number;
  busy: boolean;
  opening: boolean;
  listSheets(role: InstanceRole): Promise<SheetLoadingResult | undefined>;
  openSheet(
    request: Extract<SheetLoadingRequest, { action: 'open' }>,
  ): Promise<SheetLoadingResult | undefined>;
}

// Show the logical document location and message returned by the loader.
function formatDiagnostic({ document, pointer, message }: Diagnostic): string {
  return [document, pointer, message].filter(Boolean).join(' ');
}

/**
 * Let users select and open a saved sheet from the active system.
 * @param props Current selection revision and the shared action guard's opening state and callback.
 * @returns The saved-sheet picker and its latest successful preview.
 */
export function SheetLoadingPanel({
  selectionRevision,
  busy,
  opening,
  listSheets,
  openSheet,
}: SheetLoadingPanelProps) {
  const [role, setRole] = useState<InstanceRole>(INSTANCE_ROLES[0]);
  const [choices, setChoices] = useState<SheetChoices>();
  const [id, setId] = useState('');
  const [listing, setListing] = useState(true);
  const [listIssue, setListIssue] = useState('');
  const [retry, setRetry] = useState(0);
  const [openIssue, setOpenIssue] = useState('');
  const [opened, setOpened] = useState<OpenedSheet>();
  const preview = useRef<HTMLHeadingElement>(null);
  const sheetPicker = useRef<HTMLSelectElement>(null);
  const restoreOpenFocus = useRef(false);
  const listingTrigger = useRef<HTMLElement>(null);

  // Reset the preview only when main changes the active selection.
  useEffect(() => {
    restoreOpenFocus.current = false;
    setOpened(undefined);
    setOpenIssue('');
  }, [selectionRevision]);

  // Ignore replies after the effect is cleaned up, including on unmount.
  useEffect(() => {
    let current = true;
    setChoices(undefined);
    setId('');
    setListIssue('');
    setListing(true);
    // Defer acquisition so React can clean up a replayed effect before it starts IPC.
    queueMicrotask(async () => {
      if (!current) return;
      const result = await listSheets(role);
      if (!current) return;
      setListing(false);
      if (result?.ok && result.action === 'list') {
        setChoices(result);
      } else {
        setListIssue('Saved sheets could not be listed. Refresh the list to try again.');
      }
    });
    return () => {
      current = false;
    };
  }, [selectionRevision, role, retry, listSheets]);

  useEffect(() => {
    if (opened) preview.current?.focus();
  }, [opened]);

  // Consume each open failure once so later library actions keep their own focus.
  useEffect(() => {
    if (!openIssue || busy || listing || !restoreOpenFocus.current) return;
    restoreOpenFocus.current = false;
    sheetPicker.current?.focus();
  }, [openIssue, busy, listing]);

  // Return keyboard focus to the control that triggered discovery once it is enabled.
  useEffect(() => {
    if (busy || listing) return;
    listingTrigger.current?.focus();
    listingTrigger.current = null;
  }, [busy, listing]);

  // Open the selected ID using the revision that produced its choices.
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !choices || !choices.sheets.some((sheet) => sheet.id === id)) return;
    setOpenIssue('');
    const result = await openSheet({
      action: 'open',
      role,
      id,
      selectionRevision: choices.selectionRevision,
    });
    if (!result) return;
    if (result.ok && result.action === 'open') {
      setOpened(result);
    } else if (!result.ok) {
      let message = 'The sheet could not be opened. Choose a saved sheet and try again.';
      if (result.code === 'BUSY')
        message = 'Another library action is in progress. Try again when it finishes.';
      if (result.code === 'STALE_SELECTION') {
        message = 'The library selection changed. Choose a sheet from the refreshed list.';
        setRetry((value) => value + 1);
      }
      if (result.diagnostics?.length) message = result.diagnostics.map(formatDiagnostic).join(' ');
      restoreOpenFocus.current = true;
      setOpenIssue(message);
    }
  }

  const status = opening
    ? 'Opening sheet…'
    : listing
      ? 'Finding saved sheets…'
      : choices?.sheets.length === 0
        ? 'No saved sheets for this role.'
        : opened
          ? 'Opened ' +
            opened.sheet.displayName +
            (opened.mode === 'read-only' ? ' in read-only mode.' : '.')
          : '';

  return (
    <section aria-labelledby="sheet-loading-heading">
      <h2 id="sheet-loading-heading">Open a saved sheet</h2>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <legend>Saved sheet</legend>
          <label htmlFor="loading-role">Role</label>
          <select
            id="loading-role"
            value={role}
            onChange={(event) => {
              const nextRole = INSTANCE_ROLES.find(
                (choice) => choice === event.currentTarget.value,
              );
              if (nextRole) {
                listingTrigger.current = event.currentTarget;
                setRole(nextRole);
                setOpenIssue('');
              }
            }}
          >
            {INSTANCE_ROLES.map((choice) => (
              <option key={choice} value={choice}>
                {choice.charAt(0).toUpperCase() + choice.slice(1)}
              </option>
            ))}
          </select>
          <label htmlFor="loading-sheet">Saved sheet</label>
          <select
            id="loading-sheet"
            ref={sheetPicker}
            disabled={!choices?.sheets.length}
            value={id}
            onChange={(event) => {
              setId(event.currentTarget.value);
              setOpenIssue('');
            }}
            aria-describedby={openIssue ? 'loading-error' : undefined}
          >
            <option value="">Choose a saved sheet</option>
            {choices?.sheets.map(({ id, displayName }) => (
              <option key={id} value={id}>
                {displayName ? `${displayName} (${id})` : id}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!id || listing}>
            Open sheet
          </button>
          <button
            type="button"
            disabled={listing}
            onClick={(event) => {
              listingTrigger.current = event.currentTarget;
              setRetry((value) => value + 1);
            }}
          >
            Refresh saved sheets
          </button>
        </fieldset>
      </form>
      <p role="status">{status}</p>
      <p role="alert" id="loading-error">
        {openIssue || listIssue}
      </p>
      {opened?.mode === 'read-only' && (
        <div>
          <p>
            This sheet is read-only because the system or template version it was saved with is
            unavailable.
          </p>
          <ul>
            {opened.diagnostics.map((diagnostic, index) => (
              <li key={index}>{formatDiagnostic(diagnostic)}</li>
            ))}
          </ul>
        </div>
      )}
      {opened && <SheetPreview id="loading-preview" sheet={opened.sheet} headingRef={preview} />}
    </section>
  );
}
