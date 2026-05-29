import { useEffect, useState } from 'react';
import type { AuthSession } from '@ollu/shared-types';
import { getSdk } from '../../sync';

const DEFAULT_SERVER = (import.meta.env.VITE_OLLU_SERVER as string | undefined) ?? '';

/**
 * Cross-device sync controls. Lazy-loaded by SettingsScreen only when
 * VITE_BKDOJO_SYNC=1, so the SDK never lands in the default bundle.
 */
export default function SyncSection() {
  const sdk = getSdk();
  const [session, setSession] = useState<AuthSession | null>(sdk?.auth.currentSession() ?? null);
  const [serverUrl, setServerUrl] = useState(sdk?.config.get() ?? DEFAULT_SERVER);
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sdk) return;
    return sdk.auth.onChange(setSession);
  }, [sdk]);

  if (!sdk) {
    return (
      <div className="stat-block">
        <div className="stat-block__head">Синхронизация</div>
        <p className="screen__note">Не удалось инициализировать синхронизацию.</p>
      </div>
    );
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await sdk!.auth.loginWith('google');
      await sdk!.startIfAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await sdk!.engine.stop();
      await sdk!.auth.logout();
    } finally {
      setBusy(false);
    }
  }

  async function saveServer() {
    const url = serverUrl.trim();
    if (!url) return;
    await sdk!.config.set(url);
    setServerUrl(sdk!.config.get());
    setServerMsg('Сервер сохранён.');
  }

  async function resetServer() {
    await sdk!.config.reset();
    setServerUrl(sdk!.config.get());
    setServerMsg('Возвращён сервер по умолчанию.');
  }

  return (
    <div className="stat-block">
      <div className="stat-block__head">Синхронизация</div>
      {session ? (
        <>
          <ul className="ability-list">
            <li className="ability-list__row">
              <span>{session.user.email}</span>
              <span className="status status--ok">подключено</span>
            </li>
            <li className="ability-list__row">
              <span>Сервер</span>
              <span className="status status--ok">{sdk.config.get()}</span>
            </li>
          </ul>
          <div className="pet-actions">
            <button className="btn btn--ghost" onClick={() => void signOut()} disabled={busy}>
              Выйти
            </button>
          </div>
          <p className="screen__note">
            Прогресс синхронизируется между устройствами под этим аккаунтом.
          </p>
        </>
      ) : (
        <>
          <label className="screen__note" htmlFor="ollu-server">
            Сервер синхронизации
          </label>
          <div className="pet-actions">
            <input
              id="ollu-server"
              type="url"
              inputMode="url"
              autoComplete="off"
              className="text-input"
              style={{ flex: '1 1 16rem', minWidth: 0 }}
              value={serverUrl}
              placeholder={DEFAULT_SERVER || 'https://sync.example.com'}
              onChange={(e) => {
                setServerUrl(e.target.value);
                setServerMsg(null);
              }}
            />
            <button className="btn btn--ghost" onClick={() => void saveServer()}>
              Сохранить
            </button>
            <button className="btn btn--ghost" onClick={() => void resetServer()}>
              По умолчанию
            </button>
          </div>
          {serverMsg && <p className="screen__note">{serverMsg}</p>}

          <div className="pet-actions">
            <button className="btn btn--ghost" onClick={() => void signIn()} disabled={busy}>
              {busy ? 'Вход…' : 'Войти через Google'}
            </button>
          </div>
          <p className="screen__note">
            Войди, чтобы синхронизировать прогресс между устройствами. Без входа всё хранится
            только в этом браузере. Сервер можно переопределить до входа.
          </p>
        </>
      )}
      {error && <p className="screen__note">{error}</p>}
    </div>
  );
}
