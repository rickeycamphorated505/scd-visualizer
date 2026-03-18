import { useMemo } from 'react';
import type { Change } from '../diff/types';
import { Button } from './ui';

interface ChangesPanelProps {
  changes: Change[];
  selectedIedName?: string | null;
  selectedChangeId: string | null;
  filters: {
    type: 'all' | 'added' | 'modified' | 'removed';
    area: 'all' | 'Communication' | 'GOOSE' | 'SV' | 'Reporting' | 'Generic';
    query: string;
  };
  onFilterChange: (next: Partial<ChangesPanelProps['filters']>) => void;
  onSelectChange: (id: string) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export default function ChangesPanel({
  changes,
  selectedIedName,
  selectedChangeId,
  filters,
  onFilterChange,
  onSelectChange,
  onExportJson,
  onExportCsv,
}: ChangesPanelProps): JSX.Element {
  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return changes.filter((change) => {
      if (filters.type !== 'all' && change.changeType !== filters.type) {
        return false;
      }
      if (filters.area !== 'all' && change.area !== filters.area) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        change.summary.toLowerCase().includes(q) ||
        (change.iedName || '').toLowerCase().includes(q) ||
        change.key.toLowerCase().includes(q)
      );
    });
  }, [changes, filters]);

  const selectedIedChanges = useMemo(() => {
    if (!selectedIedName) {
      return [];
    }
    return filtered.filter((change) => change.iedName === selectedIedName);
  }, [filtered, selectedIedName]);

  return (
    <aside className="panel navigator-panel">
      <div className="panel-title-row">
        <h2>Changes</h2>
        <span className="file-pill">{changes.length}</span>
      </div>

      <div className="filter-grid">
        <select className="input" value={filters.type} onChange={(e) => onFilterChange({ type: e.target.value as ChangesPanelProps['filters']['type'] })}>
          <option value="all">Type: all</option>
          <option value="added">Added</option>
          <option value="modified">Modified</option>
          <option value="removed">Removed</option>
        </select>
        <select className="input" value={filters.area} onChange={(e) => onFilterChange({ area: e.target.value as ChangesPanelProps['filters']['area'] })}>
          <option value="all">Area: all</option>
          <option value="Communication">Communication</option>
          <option value="GOOSE">GOOSE</option>
          <option value="SV">SV</option>
          <option value="Reporting">Reporting</option>
          <option value="Generic">Generic</option>
        </select>
        <input className="input" value={filters.query} onChange={(e) => onFilterChange({ query: e.target.value })} placeholder="Search changes" />
      </div>

      <div className="tabs-row wrap">
        <Button onClick={onExportJson}>Export changes JSON</Button>
        <Button onClick={onExportCsv}>Export changes CSV</Button>
      </div>

      <div className="issues-list">
        {selectedIedName ? (
          <div className="issue-card">
            <strong>Changes for selected IED: {selectedIedName}</strong>
            <p className="hint">{selectedIedChanges.length} change(s)</p>
            {selectedIedChanges.length === 0 ? <p className="hint">No change matches current filters for this IED.</p> : null}
            {selectedIedChanges.map((change) => (
              <button
                key={`selected:${change.id}`}
                className={`issue-card change-${change.changeType} ${selectedChangeId === change.id ? 'active' : ''}`}
                onClick={() => onSelectChange(change.id)}
              >
                <strong>{change.summary}</strong>
                <p>{change.path}</p>
              </button>
            ))}
          </div>
        ) : null}

        <div className="issue-card">
          <strong>All changes</strong>
          <p className="hint">{filtered.length} total</p>
        </div>

        {filtered.map((change) => (
          <button
            key={change.id}
            className={`issue-card change-${change.changeType} ${selectedChangeId === change.id ? 'active' : ''}`}
            onClick={() => onSelectChange(change.id)}
          >
            <strong>{change.summary}</strong>
            <p>{change.path}</p>
          </button>
        ))}
        {filtered.length === 0 ? <p className="hint">No changes match filters.</p> : null}
      </div>
    </aside>
  );
}
