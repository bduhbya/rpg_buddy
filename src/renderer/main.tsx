import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ApplicationInfoResult } from '../shared/application-info';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { EditableSheet } from './editable-sheet';
import type { SheetView } from './sheet-view';
import { LibraryPanel } from './library-panel';
import { createRendererWorkflowLog } from './renderer-logger';

const simulationLog = createRendererWorkflowLog('diagnostic.simulation');
const applicationInfoLog = createRendererWorkflowLog('application.info');
const sheetViewLog = createRendererWorkflowLog('sheet.view');

interface ActiveSheetView extends SheetView {
  trigger: HTMLButtonElement;
  operationId: string;
  scrollPosition: number;
}

// Render application information and the support diagnostic action.
function App() {
  const [sheetView, setSheetView] = useState<ActiveSheetView>();
  const heading = useRef<HTMLHeadingElement>(null);
  const returning = useRef<ActiveSheetView>(null);

  // Wait until the destination is visible before moving focus or restoring scroll.
  useLayoutEffect(() => {
    if (sheetView) {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    } else if (returning.current) {
      const { trigger, scrollPosition } = returning.current;
      returning.current = null;
      window.scrollTo(0, scrollPosition);
      trigger.focus({ preventScroll: true });
    }
  }, [sheetView]);

  // Keep the main page mounted so its form controls and latest results survive the visit.
  function viewSheet(view: SheetView, trigger: HTMLButtonElement) {
    const operationId = crypto.randomUUID();
    setSheetView({ ...view, trigger, operationId, scrollPosition: window.scrollY });
    void sheetViewLog.recordSuccess('view.enter', operationId);
  }

  // Return to the originating control and correlate both navigation outcomes.
  function returnToMain() {
    if (!sheetView) return;
    returning.current = sheetView;
    setSheetView(undefined);
    void sheetViewLog.recordSuccess('view.return', sheetView.operationId);
  }

  const [diagnostic, setDiagnostic] = useState('');
  const [busy, setBusy] = useState(false);
  // Report whether both halves of the support simulation were queued.
  async function simulateFailure() {
    setBusy(true);
    const operation = crypto.randomUUID();
    try {
      throw new Error('Simulated diagnostic failure');
    } catch (error) {
      const result = await simulationLog.recordFailure(
        'renderer.exercise',
        'SIMULATED_FAILURE',
        error,
        operation,
      );
      setDiagnostic(
        result.ok
          ? `Diagnostic queued. Operation ID: ${operation}`
          : 'Diagnostic logging is unavailable. The application can still be used.',
      );
    } finally {
      setBusy(false);
    }
  }
  const [result, setResult] = useState<ApplicationInfoResult>();
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const info = await window.rpgBuddy.getApplicationInfo({ reportTransportFailure: true });
        if (active) setResult(info);
      } catch (error) {
        if (active) {
          setResult(
            applicationInfoLog.failure(
              { ok: false, code: 'UNAVAILABLE' },
              'bridge.invoke',
              'BRIDGE_UNAVAILABLE',
              error,
            ),
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <main hidden={Boolean(sheetView)}>
        <p className="eyebrow">Your tabletop companion</p>
        <h1>RPG Buddy</h1>
        <p className="message">RPG Buddy is ready.</p>
        <p>A home for your characters and adventures, for players and game masters.</p>
        <LibraryPanel viewSheet={viewSheet} />
        <section aria-labelledby="application-info-heading">
          <h2 id="application-info-heading">Application information</h2>
          {!result && <p role="status">Loading application information…</p>}
          {result && !result.ok && (
            <p role="alert">Application information is unavailable. Reload to try again.</p>
          )}
          {result?.ok && (
            <dl>
              <dt>Application</dt>
              <dd>{result.info.name}</dd>
              <dt>Version</dt>
              <dd>{result.info.version}</dd>
              <dt>Electron</dt>
              <dd>{result.info.electron}</dd>
              <dt>Chrome</dt>
              <dd>{result.info.chrome}</dd>
              <dt>Node</dt>
              <dd>{result.info.node}</dd>
            </dl>
          )}
        </section>
        <section aria-labelledby="diagnostics-heading">
          <h2 id="diagnostics-heading">Support diagnostics</h2>
          <p>Record a simulated failure to help verify local diagnostic logging.</p>
          <button type="button" disabled={busy} onClick={() => void simulateFailure()}>
            Simulate diagnostic failure
          </button>
          <p role="status">{diagnostic}</p>
        </section>
      </main>
      {sheetView && <EditableSheet view={sheetView} heading={heading} back={returnToMain} />}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('The application root element is missing.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
