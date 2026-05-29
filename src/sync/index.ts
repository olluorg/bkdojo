/**
 * Sync entry point. Imported dynamically from `main.tsx` only when
 * VITE_BKDOJO_SYNC=1, so the SDK and its dependencies stay out of the default
 * (flag-off) bundle. Failure here is non-fatal: the app continues offline-only.
 */

import { getSdk, initSdk, INCOMING_EVENT } from './setup';

export { getSdk, INCOMING_EVENT };
export type { SdkBundle } from './setup';

export async function initSync(): Promise<void> {
  try {
    await initSdk({
      defaultServerUrl:
        (import.meta.env.VITE_OLLU_SERVER as string | undefined) ?? 'http://localhost:8080',
      googleClientId: import.meta.env.VITE_OLLU_GOOGLE_CLIENT_ID as string | undefined,
    });
  } catch (err) {
    console.warn('[sync] init failed, app continues without sync:', err);
  }
}
