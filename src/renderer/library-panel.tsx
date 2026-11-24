import { useCallback, useEffect, useRef, useState } from 'react';
import { LIBRARY_API_VERSION } from '../shared/library-selection';
import type { LibraryRequest, LibraryResult, LibraryView } from '../shared/library-selection';
import type { SheetCreationRequest, SheetCreationResult } from '../shared/sheet-creation-contract';
import { SheetCreationPanel } from './sheet-creation-panel';
import { createRendererWorkflowLog } from './renderer-logger';

import { SheetLoadingPanel } from './sheet-loading-panel';
import type { SheetLoadingRequest, SheetLoadingResult } from '../shared/sheet-loading-contract';

import type { ViewSheet } from './sheet-view';

type LibraryAction = 'choose' | 'load' | 'create' | 'list' | 'open';

const libraryLog = createRendererWorkflowLog('library.request');

/**
 * Render the library picker, system selection and accessible loading feedback.
 * @param props The callback for viewing a workflow result.
 * @returns The library controls displayed in the desktop shell.
 */
export function LibraryPanel({ viewSheet }: { viewSheet: ViewSheet }) {
  const [view, setView] = useState<LibraryView>();
  const [candidate, setCandidate] = useState('');
  const [status, setStatus] = useState('Checking the remembered library…');
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState<LibraryAction>();
  const inFlight = useRef(false);
  const actionSequence = useRef(0);
  const picker = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      let result: LibraryResult;
      try {
        result = await window.rpgBuddy.librarySelection(
          { apiVersion: LIBRARY_API_VERSION, action: 'get' },
          { reportTransportFailure: true },
        );
      } catch (error) {
        if (!active || actionSequence.current !== 0) return;
        result = libraryLog.failure(
          { ok: false, code: 'UNAVAILABLE' },
          'view.request',
          'BRIDGE_UNAVAILABLE',
          error,
        );
      }

      if (!active || actionSequence.current !== 0) return;
      setStatus('');
      if (result.ok) {
        setView(result.view);
        if (result.view.activeSystem) {
          setCandidate(result.view.activeSystem.id);
          setStatus(`Loaded ${result.view.activeSystem.label}.`);
        }
        setIssue(result.view.issue ?? '');
      } else {
        setIssue('Library settings are unavailable. Choose a library folder to try again.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Refresh the authoritative view after an unsuccessful picker action can overlap a load.
  async function refreshAfterPicker(actionId: number, previous: LibraryView | undefined) {
    try {
      const result = await window.rpgBuddy.librarySelection({
        apiVersion: LIBRARY_API_VERSION,
        action: 'get',
      });
      if (!result.ok || actionSequence.current !== actionId) return;
      setView(result.view);
      const selected = result.view.activeSystem;
      if (selected && !previous?.activeSystem) {
        setCandidate((current) => current || selected.id);
        setStatus((current) => [current, `Loaded ${selected.label}.`].filter(Boolean).join(' '));
      }
      if (result.view.issue) setIssue((current) => current || result.view.issue || '');
    } catch {
      // Keep the picker's outcome visible if the refresh cannot reach main.
    }
  }

  // Acquire the guard immediately and always clear it when the operation settles.
  const runAction = useCallback(
    async <T,>(action: LibraryAction, run: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setBusy(action);
      try {
        return await run();
      } finally {
        inFlight.current = false;
        setBusy(undefined);
      }
    },
    [],
  );

  // Restore focus to the folder control after the native picker closes.
  async function perform(action: Exclude<LibraryRequest, { action: 'get' }>) {
    if (inFlight.current) return;
    try {
      await runAction(action.action, async () => {
        const actionId = ++actionSequence.current;
        setIssue('');
        setStatus(
          action.action === 'choose' ? 'Choosing a library folder…' : `Loading ${action.systemId}…`,
        );
        let result: LibraryResult;
        try {
          result = await window.rpgBuddy.librarySelection(action, { reportTransportFailure: true });
        } catch (error) {
          result = libraryLog.failure(
            { ok: false, code: 'UNAVAILABLE' },
            action.action === 'choose' ? 'folder.request' : 'system.request',
            'BRIDGE_UNAVAILABLE',
            error,
          );
        }
        setStatus('');
        if (!result.ok) {
          setIssue('The library action could not be completed. Try again.');
          if (action.action === 'choose') void refreshAfterPicker(actionId, view);
          return;
        }
        setView(result.view);
        setIssue(result.view.issue ?? '');
        if (action.action === 'choose' && result.outcome !== 'accepted') {
          void refreshAfterPicker(actionId, view);
        }
        if (result.outcome === 'cancelled') {
          setStatus('Folder selection cancelled.');
        } else if (result.outcome === 'accepted' && action.action === 'choose') {
          setCandidate('');
          setStatus('Library folder selected.');
        } else if (result.outcome === 'accepted' && result.view.activeSystem) {
          setStatus(`Loaded ${result.view.activeSystem.label}.`);
        }
      });
    } finally {
      if (action.action === 'choose') picker.current?.focus();
    }
  }

  // Normalize transport failure so the form can restore focus and show recovery feedback.
  function createSheet(request: SheetCreationRequest): Promise<SheetCreationResult | undefined> {
    return runAction<SheetCreationResult>('create', async () => {
      try {
        return await window.rpgBuddy.createCharacterSheet(request);
      } catch {
        return {
          ok: false,
          code: 'UNAVAILABLE',
          message: 'The sheet could not be created. Try again.',
        };
      }
    });
  }

  // Fetch choices under the same guard as opening and changing the library.
  const listSheets = useCallback(
    (role: Extract<SheetLoadingRequest, { action: 'list' }>['role']) =>
      runAction<SheetLoadingResult>('list', async () => {
        try {
          return await window.rpgBuddy.sheetLoading({ action: 'list', role });
        } catch {
          return { ok: false, code: 'UNAVAILABLE' };
        }
      }),
    [runAction],
  );

  // Keep library, system and sheet controls steady for the full opening round trip.
  function openSheet(
    request: Extract<SheetLoadingRequest, { action: 'open' }>,
  ): Promise<SheetLoadingResult | undefined> {
    return runAction<SheetLoadingResult>('open', async () => {
      try {
        return await window.rpgBuddy.sheetLoading(request);
      } catch {
        return { ok: false, code: 'UNAVAILABLE' };
      }
    });
  }

  const hasSystems = Boolean(view?.systemIds.length);
  return (
    <>
      <section aria-labelledby="library-heading">
        <h2 id="library-heading">Game library</h2>
        <p>
          {view?.folderPath
            ? `Library folder: ${view.folderPath}`
            : 'Choose a local library folder.'}
        </p>
        <button
          ref={picker}
          type="button"
          aria-disabled={busy !== undefined}
          onClick={() => void perform({ apiVersion: LIBRARY_API_VERSION, action: 'choose' })}
        >
          Choose library folder
        </button>
        {view?.folderPath && !hasSystems && <p>No system folders were found in RPG_systems.</p>}
        {hasSystems && (
          <div className="system-controls">
            <label htmlFor="library-system">Game system</label>
            <select
              id="library-system"
              value={candidate}
              disabled={busy !== undefined}
              onChange={(event) => setCandidate(event.currentTarget.value)}
            >
              <option value="">Choose a system</option>
              {view?.systemIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-disabled={!candidate || busy !== undefined}
              onClick={() => {
                if (candidate)
                  void perform({
                    apiVersion: LIBRARY_API_VERSION,
                    action: 'load',
                    systemId: candidate,
                  });
              }}
            >
              Load system
            </button>
          </div>
        )}
        {view?.activeSystem && busy !== 'load' && <p>Active system: {view.activeSystem.label}</p>}
        <p role="status">{status}</p>
        <p role="alert">{issue}</p>
      </section>
      {view?.activeSystem && (
        <SheetLoadingPanel
          selectionRevision={view.activeSystem.selectionRevision}
          busy={busy !== undefined}
          opening={busy === 'open'}
          listSheets={listSheets}
          openSheet={openSheet}
          viewSheet={viewSheet}
        />
      )}
      {view?.activeSystem && (
        <SheetCreationPanel
          activeSystem={view.activeSystem}
          busy={busy !== undefined}
          creating={busy === 'create'}
          createSheet={createSheet}
          viewSheet={viewSheet}
        />
      )}
    </>
  );
}
