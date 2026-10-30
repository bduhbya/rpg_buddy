import { StrictMode, useEffect, useState } from 'react';
import type { ApplicationInfoResult } from '../shared/application-info';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { recordRendererError } from './renderer-logger';

function App() {
  const [diagnostic, setDiagnostic] = useState('');
  const [busy, setBusy] = useState(false);
  async function simulateFailure() {
    setBusy(true);
    const operation = crypto.randomUUID();
    try {
      throw new Error('Simulated diagnostic failure');
    } catch (error) {
      const result = await recordRendererError('diagnostic.renderer.failure', error, operation);
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
        const info = await window.rpgBuddy.getApplicationInfo();
        if (active) setResult(info);
      } catch {
        if (active) setResult({ ok: false, code: 'UNAVAILABLE' });
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <main>
      <p className="eyebrow">Your tabletop companion</p>
      <h1>RPG Buddy</h1>
      <p className="message">RPG Buddy is ready.</p>
      <p>A home for your characters and adventures, for players and game masters.</p>
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
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('The application root element is missing.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
