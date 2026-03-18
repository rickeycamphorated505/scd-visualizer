import { useEffect, useMemo, useRef, useState } from 'react';
import type { ValidationIssue } from '../validation/types';
import { Button } from './ui';
import VirtualList from './network/VirtualList';

const VIRTUALIZE_THRESHOLD = 100;
const ISSUE_ROW_HEIGHT = 84;

function useContainerHeight(ref: React.RefObject<HTMLElement>): number {
  const [height, setHeight] = useState(500);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight || 500);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return height;
}

interface IssuesPanelProps {
  issues: ValidationIssue[];
  selectedIssueId: string | null;
  filters: {
    severity: 'all' | 'error' | 'warn' | 'warning' | 'info';
    category: 'all' | 'syntax' | 'semantic' | 'interop';
    protocol: 'all' | 'GOOSE' | 'SV' | 'REPORT' | 'Generic';
    status: 'all' | 'resolved' | 'unresolved';
    query: string;
  };
  onFilterChange: (next: Partial<IssuesPanelProps['filters']>) => void;
  onSelectIssue: (id: string) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onExportLandsnetJson: () => void;
}

export default function IssuesPanel({
  issues,
  selectedIssueId,
  filters,
  onFilterChange,
  onSelectIssue,
  onExportJson,
  onExportCsv,
  onExportLandsnetJson,
}: IssuesPanelProps): JSX.Element {
  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (filters.severity !== 'all' && issue.severity !== filters.severity) {
        return false;
      }
      if (filters.category !== 'all' && issue.category !== filters.category) {
        return false;
      }
      if (filters.protocol !== 'all' && issue.protocol !== filters.protocol) {
        return false;
      }
      if (filters.status !== 'all') {
        const resolved = issue.resolved ? 'resolved' : 'unresolved';
        if (resolved !== filters.status) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      return (
        issue.message.toLowerCase().includes(q) ||
        issue.code.toLowerCase().includes(q) ||
        (issue.context.iedName || '').toLowerCase().includes(q)
      );
    });
  }, [issues, filters]);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const listRef = useRef<HTMLDivElement>(null);
  const listHeight = useContainerHeight(listRef);

  return (
    <aside className="panel navigator-panel">
      <div className="panel-title-row">
        <h2>Issues</h2>
        <span className="file-pill">Issues: {issues.length} ({errorCount} errors)</span>
      </div>

      <div className="filter-grid">
        <select className="input" value={filters.severity} onChange={(e) => onFilterChange({ severity: e.target.value as IssuesPanelProps['filters']['severity'] })}>
          <option value="all">Severity: all</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select className="input" value={filters.category} onChange={(e) => onFilterChange({ category: e.target.value as IssuesPanelProps['filters']['category'] })}>
          <option value="all">Category: all</option>
          <option value="syntax">Syntax</option>
          <option value="semantic">Semantic</option>
          <option value="interop">Interop</option>
        </select>
        <select className="input" value={filters.protocol} onChange={(e) => onFilterChange({ protocol: e.target.value as IssuesPanelProps['filters']['protocol'] })}>
          <option value="all">Protocol: all</option>
          <option value="GOOSE">GOOSE</option>
          <option value="SV">SV</option>
          <option value="REPORT">REPORT</option>
          <option value="Generic">Generic</option>
        </select>
        <select className="input" value={filters.status} onChange={(e) => onFilterChange({ status: e.target.value as IssuesPanelProps['filters']['status'] })}>
          <option value="all">Status: all</option>
          <option value="resolved">Resolved</option>
          <option value="unresolved">Unresolved</option>
        </select>
        <div className="search-wrap">
          <input className="input" value={filters.query} onChange={(e) => onFilterChange({ query: e.target.value })} placeholder="Search issues" />
          {filters.query && (
            <button className="search-clear" onClick={() => onFilterChange({ query: '' })} aria-label="Clear issue search">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="tabs-row wrap">
        <Button onClick={onExportJson}>Export validation JSON</Button>
        <Button onClick={onExportCsv}>Export validation CSV</Button>
        <Button onClick={onExportLandsnetJson}>Export Landsnet JSON</Button>
      </div>

      <div className="issues-list" ref={listRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <p className="hint">No issues match filters.</p>
        ) : filtered.length > VIRTUALIZE_THRESHOLD ? (
          <VirtualList
            items={filtered}
            rowHeight={ISSUE_ROW_HEIGHT}
            height={listHeight}
            itemKey={(issue) => issue.id}
            renderRow={(issue) => (
              <button
                className={`issue-card ${issue.severity === 'error' || issue.severity === 'warn' || issue.severity === 'warning' ? 'warn' : ''} ${selectedIssueId === issue.id ? 'active' : ''}`}
                onClick={() => onSelectIssue(issue.id)}
              >
                <strong>[{issue.code}] {issue.message}</strong>
                <p>{issue.path}</p>
                <p className="hint">{issue.category.toUpperCase()} · {issue.fixHint || issue.quickFix || '-'}</p>
              </button>
            )}
          />
        ) : (
          filtered.map((issue) => (
            <button
              key={issue.id}
              className={`issue-card ${issue.severity === 'error' || issue.severity === 'warn' || issue.severity === 'warning' ? 'warn' : ''} ${selectedIssueId === issue.id ? 'active' : ''}`}
              onClick={() => onSelectIssue(issue.id)}
            >
              <strong>[{issue.code}] {issue.message}</strong>
              <p>{issue.path}</p>
              <p className="hint">{issue.category.toUpperCase()} · {issue.fixHint || issue.quickFix || '-'}</p>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
