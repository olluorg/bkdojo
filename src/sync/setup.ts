/**
 * SDK wiring for cross-device progress sync (opt-in; built only when
 * VITE_BKDOJO_SYNC=1). Ported from reader's sync plugin.
 *
 * Configuration comes from Vite env vars:
 *   VITE_OLLU_SERVER           default sync server URL (overridable in settings)
 *   VITE_OLLU_GOOGLE_CLIENT_ID Google OAuth client ID for login
 */

import {
  AuthClient,
  HLClock,
  ServerUrlConfig,
  SyncEngine,
  WebSocketTransport,
  type AuthProvider,
} from '@ollu/sdk-core';
import { installIdbProxy, type IdbProxy } from '@ollu/sdk-idb';
import { DB_NAME, PROGRESS_STORES, openDb } from '../storage/db';
import { INCOMING_EVENT } from '../storage/progressDb';
import { GooglePopupProvider } from './googlePopupProvider';

const APP_ID = 'bkdojo';
const DEVICE_ID_KEY = 'bkdojo.deviceId';

export { INCOMING_EVENT };

export interface SdkBundle {
  readonly proxy: IdbProxy;
  readonly clock: HLClock;
  readonly config: ServerUrlConfig;
  readonly auth: AuthClient;
  readonly transport: WebSocketTransport;
  readonly engine: SyncEngine;
  startIfAuthed(): Promise<void>;
}

let bundle: SdkBundle | null = null;

export function getSdk(): SdkBundle | null {
  return bundle;
}

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

interface InitOptions {
  readonly defaultServerUrl: string;
  readonly googleClientId?: string;
  readonly extraProviders?: readonly AuthProvider[];
}

export async function initSdk(options: InitOptions): Promise<SdkBundle> {
  if (bundle) return bundle;

  const clock = new HLClock(getOrCreateDeviceId());
  let engineRef: SyncEngine | null = null;

  // Must run before any indexedDB.open of DB_NAME so the proxy patches it.
  const proxy = installIdbProxy({
    dbName: DB_NAME,
    appId: APP_ID,
    syncedStores: PROGRESS_STORES,
    clock,
    onLocalWrite: () => engineRef?.schedule(),
  });

  await openDb();
  await proxy.ready();

  const config = new ServerUrlConfig({
    defaultServerUrl: options.defaultServerUrl,
    kv: proxy.kv,
  });
  await config.load();

  const providers: AuthProvider[] = [];
  if (options.googleClientId) {
    providers.push(
      new GooglePopupProvider({
        clientId: options.googleClientId,
        redirectUri: location.origin + location.pathname,
      }),
    );
  }
  if (options.extraProviders) providers.push(...options.extraProviders);

  const auth = new AuthClient({
    serverUrl: () => config.get(),
    providers,
    kv: proxy.kv,
  });
  await auth.hydrate();

  const transport = new WebSocketTransport({
    serverUrl: () => config.get(),
    appId: APP_ID,
    sessionToken: () => auth.sessionToken(),
    onUnauthorized: async () => {
      await auth.ensureFresh();
    },
  });

  const engine = new SyncEngine({
    appId: APP_ID,
    clock,
    outbox: proxy.outbox,
    transport,
    kv: proxy.kv,
    onIncoming: async (ops) => {
      await proxy.applyIncoming(ops);
      window.dispatchEvent(new CustomEvent(INCOMING_EVENT));
    },
  });
  engineRef = engine;

  bundle = {
    proxy,
    clock,
    config,
    auth,
    transport,
    engine,
    startIfAuthed: async () => {
      if (auth.currentSession() && !engine.isRunning()) {
        await engine.start();
      }
    },
  };

  await bundle.startIfAuthed();
  return bundle;
}
