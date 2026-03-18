import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SclModel } from '../model/types';

interface CommandItem {
  id: string;
  label: string;
  keywords: string;
  type: 'ied' | 'ln' | 'dataset' | 'control';
  focusIed?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model?: SclModel;
  onSelectItem: (item: CommandItem) => void;
}

export default function CommandPalette({
  open,
  onOpenChange,
  model,
  onSelectItem,
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => buildItems(model), [model]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.slice(0, 80);
    }
    return items
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q))
      .slice(0, 80);
  }, [items, query]);

  const clampedActiveIndex = filtered.length === 0 ? -1 : Math.min(activeIndex, filtered.length - 1);

  if (!open) {
    return null;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    if (filtered.length === 0) {
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => {
        if (filtered.length === 0) {
          return -1;
        }
        const next = prev < 0 ? 0 : Math.min(prev + 1, filtered.length - 1);
        return next;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => {
        if (filtered.length === 0) {
          return -1;
        }
        const next = prev <= 0 ? 0 : prev - 1;
        return next;
      });
      return;
    }
    if (e.key === 'Enter') {
      // Velja virka línu þegar Enter er slegið í inputinu
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && clampedActiveIndex >= 0 && filtered[clampedActiveIndex]) {
        e.preventDefault();
        const item = filtered[clampedActiveIndex]!;
        onSelectItem(item);
        onOpenChange(false);
        setQuery('');
      }
    }
  }

  return (
    <div
      className="cmdk-backdrop"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="cmdk-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to entity"
        onKeyDown={handleKeyDown}
      >
        <input
          autoFocus
          className="cmdk-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to IED, LN, DataSet, ControlBlock..."
          aria-label="Search entities"
        />
        <div className="cmdk-list" role="listbox" aria-label="Search results">
          {filtered.map((item, index) => {
            const isActive = index === clampedActiveIndex;
            return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`cmdk-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                onSelectItem(item);
                onOpenChange(false);
                setQuery('');
              }}
            >
              <span className="cmdk-type">{item.type.toUpperCase()}</span>
              <span>{item.label}</span>
            </button>
          );})}
          {filtered.length === 0 ? <p className="cmdk-empty">No matches.</p> : null}
        </div>
      </div>
    </div>
  );
}

function buildItems(model?: SclModel): CommandItem[] {
  if (!model) {
    return [];
  }

  const items: CommandItem[] = [];

  for (const ied of model.ieds) {
    items.push({
      id: `ied:${ied.name}`,
      label: `IED ${ied.name}`,
      keywords: `${ied.name} ${ied.bayNames.join(' ')}`,
      type: 'ied',
      focusIed: ied.name,
    });

    for (const ld of ied.lDevices) {
      if (ld.ln0) {
        items.push({
          id: `ied:${ied.name}:ld:${ld.inst}:ln0`,
          label: `LN0 ${ld.ln0.lnClass} (${ied.name}/${ld.inst})`,
          keywords: `${ld.ln0.lnClass} ${ld.ln0.inst}`,
          type: 'ln',
          focusIed: ied.name,
        });
      }
      for (const ln of ld.lns) {
        items.push({
          id: `ied:${ied.name}:ld:${ld.inst}:ln:${ln.lnClass}:${ln.inst}`,
          label: `LN ${ln.lnClass}${ln.inst ? `.${ln.inst}` : ''} (${ied.name}/${ld.inst})`,
          keywords: `${ln.lnClass} ${ln.inst}`,
          type: 'ln',
          focusIed: ied.name,
        });
      }
    }
  }

  for (const ds of model.dataSets) {
    items.push({
      id: ds.key,
      label: `DataSet ${ds.name} (${ds.iedName})`,
      keywords: `${ds.name} ${ds.ldInst} ${ds.lnClass}`,
      type: 'dataset',
      focusIed: ds.iedName,
    });
  }

  for (const cb of [...model.gseControls, ...model.svControls, ...model.reportControls]) {
    items.push({
      id: cb.key,
      label: `${cb.type} ${cb.name} (${cb.iedName})`,
      keywords: `${cb.name} ${cb.datSet || ''}`,
      type: 'control',
      focusIed: cb.iedName,
    });
  }

  return items;
}
