import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main>
      <p className="eyebrow">Your tabletop companion</p>
      <h1>RPG Buddy</h1>
      <p className="message">RPG Buddy is ready.</p>
      <p>A home for your characters and adventures, for players and game masters.</p>
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
