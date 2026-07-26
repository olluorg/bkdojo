import { lazy, Suspense, useRef, useState } from 'react';
import { serverEndpoint } from '../../domain/evaluation/ServerAiEvaluator';
import { getProviderKey, setProviderKey } from '../../domain/evaluation/providerKey';
import {
  LLM_PROVIDERS,
  getProviderId,
  setProviderId,
  getModelOverride,
  setModelOverride,
  getProvider,
} from '../../domain/evaluation/llmProvider';
import { EVAL_METHOD_HINTS, EVAL_METHOD_LABELS, type EvalMethod } from '../../domain/models/settings';
import { THEMES, THEME_LABELS, getTheme, setTheme, type Theme } from '../../app/theme';
import { parseProgress, serializeProgress } from '../../storage/progressStorage';
import { useAiCapability, type AiStatus } from '../../hooks/useAiCapability';
import { useProgress } from '../../state/ProgressContext';
import { GoalEditor } from './GoalEditor';

// Sync UI (and the SDK it pulls in) is loaded only when the build flag is set.
// Gating the dynamic import on the static flag lets Vite drop the SyncSection
// chunk (and the whole SDK) from the default offline-only build.
const SYNC_ENABLED = import.meta.env.VITE_BKDOJO_SYNC === '1';
const SyncSection = SYNC_ENABLED ? lazy(() => import('./SyncSection')) : null;

const METHODS: EvalMethod[] = ['auto', 'server', 'chrome', 'manual'];

const CHROME_STATUS: Record<AiStatus, { label: string; tone: 'ok' | 'warn' | 'off' }> = {
  available: { label: 'доступен', tone: 'ok' },
  downloadable: { label: 'можно скачать', tone: 'warn' },
  downloading: { label: 'загружается', tone: 'warn' },
  unavailable: { label: 'недоступен', tone: 'off' },
  checking: { label: 'проверяю…', tone: 'warn' },
};

export function SettingsScreen() {
  const { progress, dispatch } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';
  const chrome = useAiCapability();
  const endpoint = serverEndpoint();
  const chromeStatus = CHROME_STATUS[chrome];

  const fileInput = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(getProviderKey());
  const [providerId, setProvider] = useState(getProviderId());
  const [model, setModel] = useState(getModelOverride());
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const serverReady = !!endpoint && !!apiKey;

  function saveTheme(value: Theme) {
    setThemeState(value);
    setTheme(value);
  }

  function saveApiKey(value: string) {
    setApiKey(value);
    setProviderKey(value);
  }

  function saveProvider(value: string) {
    setProvider(value);
    setProviderId(value);
  }

  function saveModel(value: string) {
    setModel(value);
    setModelOverride(value);
  }

  function exportProgress() {
    const blob = new Blob([serializeProgress(progress)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bkdojo-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importProgress(file: File) {
    const text = await file.text();
    const parsed = parseProgress(text);
    if (!parsed) {
      setImportMsg('Не удалось прочитать файл прогресса.');
      return;
    }
    dispatch({ type: 'merge', progress: parsed });
    setImportMsg('Прогресс объединён с текущим — ничего не потеряно.');
  }

  return (
    <section>
      <h1 className="screen__title">Настройки</h1>

      <GoalEditor />

      <div className="stat-block">
        <div className="stat-block__head">Тема оформления</div>
        <div className="depth-switch">
          {THEMES.map((t) => (
            <button
              key={t}
              className={t === theme ? 'depth-btn depth-btn--active' : 'depth-btn'}
              onClick={() => saveTheme(t)}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="screen__note">
          «Системная» следует за настройкой светлой/тёмной темы в вашей ОС. Хранится только в этом
          браузере.
        </p>
      </div>

      <div className="stat-block">
        <div className="stat-block__head">Способ оценки открытых ответов</div>
        <div className="depth-switch">
          {METHODS.map((m) => (
            <button
              key={m}
              className={m === method ? 'depth-btn depth-btn--active' : 'depth-btn'}
              onClick={() => dispatch({ type: 'setEvalMethod', method: m })}
            >
              {EVAL_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="screen__note">{EVAL_METHOD_HINTS[method]}</p>
      </div>

      <div className="stat-block">
        <div className="stat-block__head">Доступность способов</div>
        <ul className="ability-list">
          <li className="ability-list__row">
            <span>Сервер (LLM)</span>
            <span className={`status status--${serverReady ? 'ok' : endpoint ? 'warn' : 'off'}`}>
              {serverReady ? 'настроен' : endpoint ? 'нужен ключ' : 'не настроен'}
            </span>
          </li>
          <li className="ability-list__row">
            <span>Chrome AI</span>
            <span className={`status status--${chromeStatus.tone}`}>{chromeStatus.label}</span>
          </li>
          <li className="ability-list__row">
            <span>Самопроверка</span>
            <span className="status status--ok">всегда доступна</span>
          </li>
        </ul>
      </div>

      {endpoint && (
        <div className="stat-block">
          <div className="stat-block__head">Провайдер LLM</div>
          <div className="depth-switch">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={p.id === providerId ? 'depth-btn depth-btn--active' : 'depth-btn'}
                onClick={() => saveProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="password"
            className="text-input"
            placeholder="API-ключ (sk-...)"
            value={apiKey}
            autoComplete="off"
            onChange={(e) => saveApiKey(e.target.value)}
          />
          <input
            type="text"
            className="text-input"
            placeholder={`Модель (по умолчанию ${getProvider().defaultModel})`}
            value={model}
            autoComplete="off"
            onChange={(e) => saveModel(e.target.value)}
          />
          <p className="screen__note">
            Серверная оценка идёт через прокси micro-platform с твоим собственным ключом.
            Провайдер, модель и ключ хранятся только в этом браузере и не синхронизируются.
          </p>
        </div>
      )}

      <div className="stat-block">
        <div className="stat-block__head">Прогресс</div>
        <div className="pet-actions">
          <button className="btn btn--ghost" onClick={exportProgress}>
            Скачать прогресс
          </button>
          <button className="btn btn--ghost" onClick={() => fileInput.current?.click()}>
            Загрузить прогресс
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importProgress(file);
              e.target.value = '';
            }}
          />
        </div>
        <p className="screen__note">
          «Скачать» сохраняет резервную копию прогресса в JSON-файл. «Загрузить» <strong>объединяет</strong>{' '}
          файл с текущим прогрессом, а не замещает его: история ответов, прочитанные уроки и закладки
          складываются вместе, а где данные пересекаются — берётся более продвинутое значение (длиннее
          серия, больше отвеченных вопросов). Локальный прогресс при загрузке не стирается, можно
          безопасно переносить данные между устройствами.
        </p>
        {importMsg && <p className="screen__note">{importMsg}</p>}
      </div>

      {SyncSection && (
        <Suspense fallback={null}>
          <SyncSection />
        </Suspense>
      )}

      <p className="screen__note">
        Если выбранный способ недоступен, ответ можно оценить самому — самопроверка всегда работает как
        запасной вариант. Серверная оценка включается переменной VITE_EVAL_ENDPOINT при сборке и
        требует выбранного провайдера и твоего ключа.
      </p>
    </section>
  );
}
