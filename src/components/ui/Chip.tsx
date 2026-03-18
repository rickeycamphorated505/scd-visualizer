import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/** Toggle chip (filter buttons: GOOSE, SV, etc.) */
export function Chip({ active = false, children, className = '', ...rest }: ChipProps): JSX.Element {
  const classes = ['chip-btn', active ? 'active' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
