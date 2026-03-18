import type { ReactNode } from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  title: string;
  description?: string;
  actions: ReactNode;
  /** Accessible label for the section */
  ariaLabel?: string;
}

export function EmptyState({ title, description, actions, ariaLabel = 'Empty state' }: EmptyStateProps): JSX.Element {
  return (
    <section className="empty-state" aria-label={ariaLabel}>
      <Card variant="elevated">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        <div className="empty-state-actions">{actions}</div>
      </Card>
    </section>
  );
}
