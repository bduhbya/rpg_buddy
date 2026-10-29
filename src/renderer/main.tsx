import { StrictMode, useEffect, useState } from 'react';
import type { ApplicationInfoResult } from '../shared/application-info';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
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
