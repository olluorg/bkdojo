import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { GlossaryTerm } from '../domain/models/glossary';
import type { Lesson, LessonImage } from '../domain/models/lesson';
import type { LessonStatus } from '../domain/progress/lessonStatus';
import { resolveLessonAsset } from '../domain/content/lessonAssets';
import { buildCandidates } from '../domain/glossary/termHighlight';
import { useGlossary } from '../hooks/useGlossary';
import { GlossaryPopup } from './GlossaryPopup';
import { LessonInteractiveBlock } from './lessonWidgets';
import { TermAwareText } from './TermAwareText';

interface RelatedLink {
  id: string;
  title: string;
}

const STATUS_BADGE: Partial<Record<LessonStatus, { label: string; className: string }>> = {
  passed: { label: '✓ Пройдено', className: 'lesson-badge lesson-badge--passed' },
  'needs-work': { label: 'Нужно доработать', className: 'lesson-badge lesson-badge--todo' },
};

interface Props {
  lesson: Lesson;
  related: RelatedLink[];
  /** Previous lesson in the same section, or `null` at the section start. */
  prev: { title: string } | null;
  /** Next lesson in the same section, or `null` at the section end. */
  next: { title: string } | null;
  /** Whether the learner has marked this lesson as read. */
  read: boolean;
  /** Whether the lesson is saved to the learner's bookmarks. */
  bookmarked: boolean;
  /** Completion state: drives the "needs work" / "passed" badge. */
  status?: LessonStatus;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Sets the read/completed state (auto on reaching the end, or manual toggle). */
  onSetRead: (read: boolean) => void;
  /** Toggles whether the lesson is bookmarked. */
  onToggleBookmark: () => void;
  onPractice: () => void;
  onOpenRelated: (id: string) => void;
  /** Extra content rendered below the lesson actions (e.g. the comment panel). */
  extra?: ReactNode;
}

/** Renders a lesson infographic; silently skips if the asset is missing. */
function LessonFigure({ image }: { image: LessonImage }) {
  const url = resolveLessonAsset(image.src);
  const [zoomed, setZoomed] = useState(false);

  // While zoomed: close on Esc and lock background scroll.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomed]);

  if (!url) return null;
  return (
    <figure className="lesson-figure">
      <button
        type="button"
        className="lesson-figure__zoom"
        onClick={() => setZoomed(true)}
        aria-label="Открыть изображение во весь экран"
      >
        <img className="lesson-figure__img" src={url} alt={image.alt} loading="lazy" />
      </button>
      {image.caption && <figcaption className="lesson-figure__caption">{image.caption}</figcaption>}
      {zoomed &&
        createPortal(
          <div
            className="lesson-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={image.alt}
            onClick={() => setZoomed(false)}
          >
            <img className="lesson-lightbox__img" src={url} alt={image.alt} />
            <button
              type="button"
              className="lesson-lightbox__close"
              aria-label="Закрыть"
              onClick={() => setZoomed(false)}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </figure>
  );
}

export function LessonReader({
  lesson,
  related,
  prev,
  next,
  read,
  bookmarked,
  status,
  onBack,
  onPrev,
  onNext,
  onSetRead,
  onToggleBookmark,
  onPractice,
  onOpenRelated,
  extra,
}: Props) {
  // Auto-mark the lesson read once its end scrolls into view — unless the learner
  // already touched the toggle (we never override an explicit choice).
  const endRef = useRef<HTMLDivElement | null>(null);
  const settledRef = useRef(false); // true after an auto-mark OR a manual toggle
  const readRef = useRef(read);
  readRef.current = read;
  const onSetReadRef = useRef(onSetRead);
  onSetReadRef.current = onSetRead;

  // Glossary highlight + popup. Candidates are built once per glossary load;
  // the popup carries the clicked term and the anchoring element.
  const glossary = useGlossary();
  const candidates = useMemo(() => buildCandidates(glossary), [glossary]);
  const [popup, setPopup] = useState<{ term: GlossaryTerm; anchor: HTMLElement } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    settledRef.current = false; // re-arm auto-mark for the newly opened lesson
    setPopup(null); // dismiss any open glossary popup when switching lessons
  }, [lesson.id]);

  useEffect(() => {
    const el = endRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !settledRef.current && !readRef.current) {
            settledRef.current = true;
            onSetReadRef.current(true);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lesson.id]);

  const handleToggleRead = () => {
    settledRef.current = true; // a manual choice disables auto-mark for this view
    onSetRead(!read);
  };

  return (
    <section>
      <button className="link-back" onClick={onBack}>
        ← К урокам
      </button>
      <h1 className="screen__title">{lesson.title}</h1>
      {status && STATUS_BADGE[status] && (
        <span className={STATUS_BADGE[status]!.className}>{STATUS_BADGE[status]!.label}</span>
      )}
      <p className="screen__note">{lesson.summary}</p>

      {lesson.sections.map((section, i) => (
        <div key={i} className="lesson-section">
          <h3 className="lesson-section__h">{section.heading}</h3>
          {section.paragraphs.map((paragraph, j) => (
            <p key={j} className="lesson-section__p">
              <TermAwareText
                text={paragraph}
                candidates={candidates}
                onTermClick={(term, anchor) => setPopup({ term, anchor })}
              />
            </p>
          ))}
          {section.image && <LessonFigure image={section.image} />}
          {section.code && <pre className="lesson-code">{section.code}</pre>}
          {section.interactive && <LessonInteractiveBlock spec={section.interactive} />}
        </div>
      ))}

      {/* Marker for "reached the end of the lesson" → auto-mark as read. */}
      <div ref={endRef} aria-hidden className="lesson-end" />

      <div className="lesson-actions">
        <button className="btn" onClick={() => onPractice()}>
          Пройти тест по теме
        </button>
        <button
          className={read ? 'btn btn--done' : 'btn btn--ghost lesson-read-btn'}
          onClick={handleToggleRead}
          aria-pressed={read}
        >
          {read ? '✓ Прочитано' : 'Отметить как прочитанный'}
        </button>
        <button
          className={
            bookmarked
              ? 'btn btn--ghost lesson-bookmark-btn lesson-bookmark-btn--on'
              : 'btn btn--ghost lesson-bookmark-btn'
          }
          onClick={onToggleBookmark}
          aria-pressed={bookmarked}
          title={bookmarked ? 'Убрать из закладок' : 'В закладки — перечитать позже'}
        >
          {bookmarked ? '★ В закладках' : '☆ В закладки'}
        </button>
      </div>

      {extra}

      <nav className="pager">
        <button className="pager__btn" onClick={onPrev}>
          <span className="pager__dir">← {prev ? 'Предыдущий урок' : 'К разделу'}</span>
          {prev && <span className="pager__title">{prev.title}</span>}
        </button>
        <button className="pager__btn pager__btn--next" onClick={onNext}>
          <span className="pager__dir">{next ? 'Следующий урок' : 'К разделу'} →</span>
          {next && <span className="pager__title">{next.title}</span>}
        </button>
      </nav>

      {related.length > 0 && (
        <div className="related">
          <h4 className="guide__sub">См. также</h4>
          <ul className="related-list">
            {related.map((link) => (
              <li key={link.id}>
                <button className="related-link" onClick={() => onOpenRelated(link.id)}>
                  {link.title} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {popup && (
        <GlossaryPopup
          term={popup.term}
          anchor={popup.anchor}
          onClose={() => setPopup(null)}
        />
      )}
    </section>
  );
}
