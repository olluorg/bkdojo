import type { ReactNode } from 'react';
import { hrefFor } from '../app/router';

interface Props {
  /** Decorative emoji/glyph. */
  icon?: string;
  title: string;
  description?: ReactNode;
  /** Optional primary action rendered as a link button. */
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Friendly, consistent "nothing here yet / can't do this yet" panel with a clear
 * next step. Shared across screens so empty and blocked states feel intentional
 * rather than broken.
 */
export function EmptyState({ icon = '🗂️', title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden>
        {icon}
      </span>
      <h2 className="empty-state__title">{title}</h2>
      {description && <p className="empty-state__desc">{description}</p>}
      {actionLabel && actionHref && (
        <a className="btn" href={hrefFor(actionHref)}>
          {actionLabel}
        </a>
      )}
    </div>
  );
}
