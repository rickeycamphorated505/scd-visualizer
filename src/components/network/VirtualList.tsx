import { useMemo, useState } from 'react';

interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  height: number;
  overscan?: number;
  className?: string;
  itemKey?: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => JSX.Element;
}

export default function VirtualList<T>({
  items,
  rowHeight,
  height,
  overscan = 6,
  className,
  itemKey,
  renderRow,
}: VirtualListProps<T>): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * rowHeight;

  const { start, end } = useMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const last = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + height) / rowHeight) + overscan,
    );
    return { start: first, end: last };
  }, [scrollTop, rowHeight, height, overscan, items.length]);

  return (
    <div
      className={className}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(start, end + 1).map((item, idx) => {
          const index = start + idx;
          const key = itemKey ? itemKey(item, index) : `vrow:${index}`;
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: index * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
              }}
            >
              {renderRow(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
