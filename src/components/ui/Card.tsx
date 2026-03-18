import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Use for empty-state cards (centered content, larger padding) */
  variant?: 'default' | 'elevated';
}

export function Card({ children, className = '', variant = 'default' }: CardProps): JSX.Element {
  const base = variant === 'elevated' ? 'empty-state-card' : 'card';
  const classes = [base, className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
