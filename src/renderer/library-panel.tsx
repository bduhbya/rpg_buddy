import { useEffect, useRef, useState } from 'react';
import { LIBRARY_API_VERSION } from '../shared/library-selection';
import type { LibraryRequest, LibraryResult, LibraryView } from '../shared/library-selection';
import { createRendererWorkflowLog } from './renderer-logger';

const libraryLog = createRendererWorkflowLog('library.request');

/**
 * Render the library picker, system selection and accessible loading feedback.
 * @returns The library controls displayed in the desktop shell.
 */
export function LibraryPanel() {
  const [view, setView] = useState<LibraryView>();
  const [candidate, setCandidate] = useState('');
  const [status, setStatus] = useState('Checking the remembered library…');
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState<'choose' | 'load'>();
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

  // Run one UI action at a time and restore focus after the native picker closes.
  async function perform(action: Exclude<LibraryRequest, { action: 'get' }>) {
    if (inFlight.current) return;
    const actionId = ++actionSequence.current;
    inFlight.current = true;
    setBusy(action.action);
    setIssue('');
    setStatus(
      action.action === 'choose' ? 'Choosing a library folder…' : `Loading ${action.systemId}…`,
    );
    try {
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
        setStatus(`Library folder selected. ${result.view.folderName ?? ''}`);
      } else if (result.outcome === 'accepted' && result.view.activeSystem) {
        setStatus(`Loaded ${result.view.activeSystem.label}.`);
      }
    } finally {
      inFlight.current = false;
      setBusy(undefined);
      if (action.action === 'choose') picker.current?.focus();
    }
  }

  const hasSystems = Boolean(view?.systemIds.length);
  return (
    <section aria-labelledby="library-heading">
      <h2 id="library-heading">Game library</h2>
      <p>
        {view?.folderName ? `Library folder: ${view.folderName}` : 'Choose a local library folder.'}
      </p>
      <button
        ref={picker}
        type="button"
        aria-disabled={busy !== undefined}
        onClick={() => void perform({ apiVersion: LIBRARY_API_VERSION, action: 'choose' })}
      >
        Choose library folder
      </button>
      {view?.folderName && !hasSystems && <p>No system folders were found in RPG_systems.</p>}
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
  );
}
