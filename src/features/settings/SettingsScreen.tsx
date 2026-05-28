import { useRef, useState } from 'react';
import { serverEndpoint } from '../../domain/evaluation/ServerAiEvaluator';
import { EVAL_METHOD_HINTS, EVAL_METHOD_LABELS, type EvalMethod } from '../../domain/models/settings';
import { parseProgress, serializeProgress } from '../../storage/progressStorage';
import { useAiCapability, type AiStatus } from '../../hooks/useAiCapability';
import { useProgress } from '../../state/ProgressContext';

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
    dispatch({ type: 'replace', progress: parsed });
    setImportMsg('Прогресс загружен.');
  }

  return (
    <section>
      <h1 className="screen__title">Настройки</h1>

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
            <span className={`status status--${endpoint ? 'ok' : 'off'}`}>
              {endpoint ? 'настроен' : 'не настроен'}
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
        {importMsg && <p className="screen__note">{importMsg}</p>}
      </div>

      <p className="screen__note">
        Если выбранный способ недоступен, ответ можно оценить самому — самопроверка всегда работает как
        запасной вариант. Серверная оценка включается переменной VITE_EVAL_ENDPOINT при сборке.
      </p>
    </section>
  );
}
