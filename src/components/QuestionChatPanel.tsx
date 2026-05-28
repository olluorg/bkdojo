import { useMemo, useState } from 'react';
import { FreeformUnavailableError } from '../domain/evaluation/freeformAi';
import type { AnswerOutcome } from '../domain/models/answer';
import type { Question } from '../domain/models/question';
import {
  askQuestionChat,
  buildQuestionChatSystem,
  outcomeAnswerText,
  type ChatMessage,
} from '../domain/questionChat/questionChat';
import { useProgress } from '../state/ProgressContext';

interface Props {
  question: Question;
  outcome: AnswerOutcome;
}

/**
 * A focused clarification chat shown after a wrong/partial answer: the learner
 * can ask follow-up questions about the question and get LLM answers grounded in
 * the question, its reference answer, and their own answer. Ephemeral — resets
 * with each question (keyed by the caller).
 */
export function QuestionChatPanel({ question, outcome }: Props) {
  const { progress } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';

  const system = useMemo(
    () => buildQuestionChatSystem(question, outcomeAnswerText(question, outcome), outcome.verdict),
    [question, outcome],
  );

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'unavailable' | string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const result = await askQuestionChat(system, next, method);
      setMessages((m) => [...m, { role: 'assistant', content: result.text }]);
    } catch (e) {
      if (e instanceof FreeformUnavailableError) setError('unavailable');
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!open) {
    return (
      <button className="btn btn--ghost qchat__open" onClick={() => setOpen(true)}>
        💬 Обсудить вопрос с AI
      </button>
    );
  }

  return (
    <div className="qchat">
      <p className="qchat__hint">
        Не до конца понял? Спроси — разберём этот вопрос и снимем все непонятные моменты.
      </p>

      {messages.length > 0 && (
        <div className="qchat__log">
          {messages.map((m, i) => (
            <div key={i} className={`qchat__msg qchat__msg--${m.role === 'user' ? 'user' : 'ai'}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="qchat__msg qchat__msg--ai qchat__msg--pending">Печатает…</div>}
        </div>
      )}

      {error === 'unavailable' && (
        <div className="banner banner--warn">
          AI недоступен. Включи Chrome Built-in AI или настрой облачную оценку в настройках, чтобы
          задавать вопросы.
        </div>
      )}
      {error && error !== 'unavailable' && (
        <div className="banner banner--warn">Не удалось получить ответ: {error}.</div>
      )}

      <div className="qchat__form">
        <textarea
          className="qchat__input"
          rows={2}
          value={input}
          placeholder="Задай уточняющий вопрос…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          aria-label="Вопрос к AI по этому вопросу"
        />
        <button className="btn qchat__send" onClick={() => void send()} disabled={busy || !input.trim()}>
          {busy ? '…' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}
