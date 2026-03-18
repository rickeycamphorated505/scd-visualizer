import type { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'accent' | 'warn' | 'success' | 'danger';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Pill-style badge for status (file name, issue count, etc.) */
export function Badge({
  variant = 'default',
  children,
  className = '',
  title,
}: BadgeProps): JSX.Element {
  const base = 'file-pill';
  const variantClass =
    variant === 'accent' ? 'has-file'
    : variant === 'warn' ? 'issues-badge'
    : variant === 'success' ? 'success-badge'
    : variant === 'danger' ? 'danger-badge'
    : '';
  const classes = [base, variantClass, className].filter(Boolean).join(' ');
  return (
    <span className={classes} title={title}>
      {children}
    </span>
  );
}
