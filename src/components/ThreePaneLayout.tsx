import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ThreePaneLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  storageKey: string;
  className?: string;
  initialLeftWidth?: number;
  initialRightWidth?: number;
  /** Changes on every tab switch; used to trigger auto-collapse/expand. */
  collapseKey?: string;
  /** When collapseKey changes and this is true → collapse both; false → expand both. */
  autoCollapse?: boolean;
  /** Small icon shown in the left collapsed rail so users can identify the panel. */
  leftIcon?: string;
  /** Small icon shown in the right collapsed rail so users can identify the panel. */
  rightIcon?: string;
}

type DragSide = 'left' | 'right' | null;

interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const HANDLE_WIDTH = 8;
const COLLAPSED_RAIL = 34;
const MIN_LEFT = 200;
const MIN_RIGHT = 240;
const MIN_CENTER = 380;

export default function ThreePaneLayout({
  left,
  center,
  right,
  storageKey,
  className,
  initialLeftWidth = 260,
  initialRightWidth = 300,
  collapseKey,
  autoCollapse,
  leftIcon = '❖',
  rightIcon = 'ℹ',
}: ThreePaneLayoutProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<DragSide>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [layout, setLayout] = useState<LayoutState>({
    leftWidth: initialLeftWidth,
    rightWidth: initialRightWidth,
    leftCollapsed: false,
    rightCollapsed: false,
  });

  // Restore only widths from localStorage — collapsed state is always driven by
  // the current tab (via collapseKey/autoCollapse) so we never restore it.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`three-pane:${storageKey}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LayoutState>;
      setLayout((prev) => ({
        ...prev,
        leftWidth: sanitizeWidth(parsed.leftWidth, prev.leftWidth, MIN_LEFT, 620),
        rightWidth: sanitizeWidth(parsed.rightWidth, prev.rightWidth, MIN_RIGHT, 760),
      }));
    } catch {
      // Ignore invalid persisted layout.
    }
  }, [storageKey]);

  // Save only widths so report-tab auto-collapse never bleeds into the next session.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        `three-pane:${storageKey}`,
        JSON.stringify({ leftWidth: layout.leftWidth, rightWidth: layout.rightWidth }),
      );
    } catch {
      // Ignore localStorage failures.
    }
  }, [layout.leftWidth, layout.rightWidth, storageKey]);

  // Auto-collapse or auto-expand both sidebars whenever the active tab changes.
  // Using collapseKey as the dependency means this fires on every tab switch,
  // even between two report tabs, so a manually-opened sidebar re-collapses.
  const prevCollapseKey = useRef(collapseKey);
  useEffect(() => {
    if (collapseKey === undefined) return;
    if (collapseKey === prevCollapseKey.current) return;
    prevCollapseKey.current = collapseKey;
    if (autoCollapse) {
      setLayout((prev) => ({ ...prev, leftCollapsed: true, rightCollapsed: true }));
    } else {
      setLayout((prev) => ({ ...prev, leftCollapsed: false, rightCollapsed: false }));
    }
  }, [collapseKey, autoCollapse]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const activeLeft = layout.leftCollapsed ? COLLAPSED_RAIL : layout.leftWidth;
      const activeRight = layout.rightCollapsed ? COLLAPSED_RAIL : layout.rightWidth;
      const maxLeft = rect.width - activeRight - HANDLE_WIDTH * 2 - MIN_CENTER;
      const maxRight = rect.width - activeLeft - HANDLE_WIDTH * 2 - MIN_CENTER;

      if (dragging === 'left') {
        const next = clamp(event.clientX - rect.left, MIN_LEFT, Math.max(MIN_LEFT, maxLeft));
        setLayout((prev) => ({ ...prev, leftWidth: next, leftCollapsed: false }));
        return;
      }
      const next = clamp(rect.right - event.clientX, MIN_RIGHT, Math.max(MIN_RIGHT, maxRight));
      setLayout((prev) => ({ ...prev, rightWidth: next, rightCollapsed: false }));
    };
    const onMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, layout.leftCollapsed, layout.leftWidth, layout.rightCollapsed, layout.rightWidth]);

  const gridTemplateColumns = useMemo(() => {
    const fitted = fitLayoutToContainer(layout, containerWidth);
    const leftPx = Number.isFinite(fitted.leftWidth) ? fitted.leftWidth : 320;
    const rightPx = Number.isFinite(fitted.rightWidth) ? fitted.rightWidth : 380;
    const leftCol = layout.leftCollapsed ? `${COLLAPSED_RAIL}px` : `${leftPx}px`;
    const leftHandle = layout.leftCollapsed ? '0px' : `${HANDLE_WIDTH}px`;
    const rightCol = layout.rightCollapsed ? `${COLLAPSED_RAIL}px` : `${rightPx}px`;
    const rightHandle = layout.rightCollapsed ? '0px' : `${HANDLE_WIDTH}px`;
    return `${leftCol} ${leftHandle} minmax(0, 1fr) ${rightHandle} ${rightCol}`;
  }, [containerWidth, layout]);

  return (
    <main
      ref={containerRef}
      className={`three-pane-layout ${className || ''}`}
      style={{ gridTemplateColumns }}
      data-dragging={dragging ? 'true' : undefined}
    >
      <section className={`three-pane-side ${layout.leftCollapsed ? 'collapsed' : ''}`}>
        {!layout.leftCollapsed ? left : (
          <button
            className="pane-rail-open"
            onClick={() => setLayout((prev) => ({ ...prev, leftCollapsed: false }))}
            title="Open left panel"
          >
            <span className="pane-rail-icon">{leftIcon}</span>
            <span className="pane-rail-chevron">›</span>
          </button>
        )}
      </section>

      <div
        className={`pane-splitter ${layout.leftCollapsed ? 'hidden' : ''}`}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.pane-toggle')) return;
          event.preventDefault();
          setDragging('left');
        }}
      >
        <button
          className="pane-toggle"
          title="Collapse left panel"
          onClick={() => setLayout((prev) => ({ ...prev, leftCollapsed: true }))}
        >
          ‹
        </button>
        <div className="pane-drag" />
      </div>

      <section className="three-pane-center">
        {center}
      </section>

      <div
        className={`pane-splitter ${layout.rightCollapsed ? 'hidden' : ''}`}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.pane-toggle')) return;
          event.preventDefault();
          setDragging('right');
        }}
      >
        <div className="pane-drag" />
        <button
          className="pane-toggle"
          title="Collapse right panel"
          onClick={() => setLayout((prev) => ({ ...prev, rightCollapsed: true }))}
        >
          ›
        </button>
      </div>

      <section className={`three-pane-side ${layout.rightCollapsed ? 'collapsed' : ''}`}>
        {!layout.rightCollapsed ? right : (
          <button
            className="pane-rail-open"
            onClick={() => setLayout((prev) => ({ ...prev, rightCollapsed: false }))}
            title="Open right panel"
          >
            <span className="pane-rail-icon">{rightIcon}</span>
            <span className="pane-rail-chevron">‹</span>
          </button>
        )}
      </section>
    </main>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function sanitizeWidth(raw: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return clamp(fallback, min, max);
  return clamp(numeric, min, max);
}

function fitLayoutToContainer(layout: LayoutState, containerWidth: number): {
  leftWidth: number;
  rightWidth: number;
} {
  const safeLeft = Number.isFinite(layout.leftWidth) ? layout.leftWidth : 320;
  const safeRight = Number.isFinite(layout.rightWidth) ? layout.rightWidth : 380;

  if (containerWidth <= 0) {
    return { leftWidth: safeLeft, rightWidth: safeRight };
  }

  let left = safeLeft;
  let right = safeRight;
  const handles = (layout.leftCollapsed ? 0 : 1) + (layout.rightCollapsed ? 0 : 1);
  const rails = (layout.leftCollapsed ? COLLAPSED_RAIL : 0) + (layout.rightCollapsed ? COLLAPSED_RAIL : 0);
  const desiredCenter = Math.min(MIN_CENTER, Math.max(280, Math.floor(containerWidth * 0.42)));
  const sideBudget = containerWidth - desiredCenter - handles * HANDLE_WIDTH - rails;

  if (sideBudget <= 0) {
    return { leftWidth: 0, rightWidth: 0 };
  }

  if (!layout.leftCollapsed && !layout.rightCollapsed) {
    const total = left + right;
    if (total > sideBudget) {
      const ratio = sideBudget / total;
      left = Math.max(80, Math.floor(left * ratio));
      right = Math.max(80, Math.floor(right * ratio));
      const after = left + right;
      if (after > sideBudget) {
        const overflow = after - sideBudget;
        if (right > left) {
          right = Math.max(0, right - overflow);
        } else {
          left = Math.max(0, left - overflow);
        }
      }
    }
  } else if (!layout.leftCollapsed) {
    left = Math.min(left, sideBudget);
  } else if (!layout.rightCollapsed) {
    right = Math.min(right, sideBudget);
  }

  return { leftWidth: left, rightWidth: right };
}
