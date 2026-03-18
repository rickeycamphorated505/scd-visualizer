import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = 'default',
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const base = 'btn';
  const variantClass = variant === 'primary' ? 'btn-primary' : '';
  const classes = [base, variantClass, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
