import type { ReactNode } from 'react';

export interface TabItem<T> {
  value: T;
  label: ReactNode;
  badge?: ReactNode;
}

interface TabsProps<T> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  className?: string;
}

/** Controlled tab list (role="tablist"). Use for view mode, Single/Compare, etc. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel = 'Tabs',
  className = 'tabs-row',
}: TabsProps<T>): JSX.Element {
  return (
    <div className={className} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isSelected = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={isSelected ? 'active' : ''}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.badge != null ? ` ${item.badge}` : null}
          </button>
        );
      })}
    </div>
  );
}
