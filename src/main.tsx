import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ProgressProvider } from './state/ProgressContext';
import { loadProgressFromDb, migrateFromLocalStorage } from './storage/progressDb';
import { relayOAuthCallbackIfPresent } from './sync/oauthCallback';
import { applyTheme, watchSystemTheme } from './app/theme';
import './app/styles.css';

async function bootstrap() {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element #root not found');

  // Sync is opt-in at build time. When enabled, the SDK installs its IndexedDB
  // proxy here — before the first DB open — so local progress writes are captured.
  if (import.meta.env.VITE_BKDOJO_SYNC === '1') {
    const { initSync } = await import('./sync');
    await initSync();
  }

  // One-time move of legacy localStorage progress into IndexedDB, then load.
  await migrateFromLocalStorage();
  const initialProgress = await loadProgressFromDb();

  createRoot(rootEl).render(
    <StrictMode>
      <ProgressProvider initialProgress={initialProgress}>
        <App />
      </ProgressProvider>
    </StrictMode>,
  );
}

// When this load is a Google OAuth popup callback, relay the result to the opener
// and close — don't boot the app in the popup.
if (!relayOAuthCallbackIfPresent()) {
  applyTheme();
  watchSystemTheme();
  void bootstrap();
}
