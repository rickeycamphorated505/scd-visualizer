import { useEffect, useMemo, useRef, useState } from 'react';
import type { ValidationFilters, ValidationIssue } from '../validation/types';
import VirtualList from './network/VirtualList';
import { Button, Chip } from './ui';

type GroupBy = 'check' | 'ied' | 'protocol' | 'category';
type GroupSort = 'count' | 'severity' | 'code';

/** Flattened row for virtualized list: either a group header or an issue row */
type FlattenedRow =
  | { type: 'group-header'; key: string; label: string; count: number }
  | { type: 'issue'; key: string; issue: ValidationIssue };

const ISSUE_ROW_HEIGHT = 44;
const VIRTUAL_LIST_MIN_HEIGHT = 200;
const VIRTUAL_LIST_MAX_HEIGHT = 520;

interface IssuesWorkspaceProps {
  issues: ValidationIssue[];
  selectedIssueId: string | null;
  filters: ValidationFilters;
  onFilterChange: (next: Partial<ValidationFilters>) => void;
  onSelectIssue: (id: string) => void;
  onOpenInGraph: (id: string) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onExportLandsnetJson: () => void;
  onShowToast?: (message: string) => void;
}

interface GroupedIssues {
  key: string;
  label: string;
  issues: ValidationIssue[];
}

export default function IssuesWorkspace({
  issues,
  selectedIssueId,
  filters,
  onFilterChange,
  onSelectIssue,
  onOpenInGraph,
  onExportJson,
  onExportCsv,
  onExportLandsnetJson,
  onShowToast,
}: IssuesWorkspaceProps): JSX.Element {

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      onShowToast?.('Copied to clipboard');
    } catch {
      onShowToast?.('Copy failed — check browser permissions');
    }
  }
  const [groupBy, setGroupBy] = useState<GroupBy>('check');
  const [groupSort, setGroupSort] = useState<GroupSort>('count');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlyLandsnet, setOnlyLandsnet] = useState(false);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [onlyNetworkIds, setOnlyNetworkIds] = useState(false);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(VIRTUAL_LIST_MAX_HEIGHT);

  // Measure the actual container height rather than guessing from window.innerHeight.
  // The container has overflow:hidden so clientHeight reflects the CSS-determined
  // flex height, not the content height — no circular dependency with VirtualList.
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const update = (): void => {
      const h = el.clientHeight;
      if (h > 0) setListHeight(Math.max(VIRTUAL_LIST_MIN_HEIGHT, h));
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const summary = useMemo(() => {
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warn' || issue.severity === 'warning').length;
    const landsnet = issues.filter((issue) => issue.code.startsWith('LNET_')).length;
    const unresolved = issues.filter((issue) => !issue.resolved).length;
    return {
      total: issues.length,
      errors,
      warnings,
      landsnet,
      unresolved,
    };
  }, [issues]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (!matchesSeverity(issue, filters.severity)) {
        return false;
      }
      if (filters.category !== 'all' && issue.category !== filters.category) {
        return false;
      }
      if (filters.protocol !== 'all' && issue.protocol !== filters.protocol) {
        return false;
      }
      if (filters.status !== 'all') {
        const status = issue.resolved ? 'resolved' : 'unresolved';
        if (status !== filters.status) {
          return false;
        }
      }

      if (onlyErrors && issue.severity !== 'error') {
        return false;
      }
      if (onlyLandsnet && !issue.code.startsWith('LNET_')) {
        return false;
      }
      if (onlyDuplicates && !/DUPLICATE|DUP_/i.test(issue.code)) {
        return false;
      }
      if (onlyNetworkIds && !/(IP|MAC|APPID)/i.test(`${issue.code} ${issue.message}`)) {
        return false;
      }

      if (!q) {
        return true;
      }
      return (
        issue.message.toLowerCase().includes(q) ||
        issue.code.toLowerCase().includes(q) ||
        issue.path.toLowerCase().includes(q) ||
        (issue.context.iedName || '').toLowerCase().includes(q)
      );
    });
  }, [issues, filters, onlyErrors, onlyLandsnet, onlyDuplicates, onlyNetworkIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of filtered) {
      const key = groupKey(issue, groupBy);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(issue);
    }

    const groups: GroupedIssues[] = Array.from(map.entries()).map(([key, list]) => ({
      key,
      label: key,
      issues: [...list].sort((a, b) => {
        const sev = severityRank(b.severity) - severityRank(a.severity);
        if (sev !== 0) {
          return sev;
        }
        return a.code.localeCompare(b.code);
      }),
    }));

    groups.sort((a, b) => {
      if (groupSort === 'count') {
        const count = b.issues.length - a.issues.length;
        if (count !== 0) {
          return count;
        }
      }
      if (groupSort === 'severity') {
        const sa = maxSeverity(a.issues);
        const sb = maxSeverity(b.issues);
        const bySeverity = severityRank(sb) - severityRank(sa);
        if (bySeverity !== 0) {
          return bySeverity;
        }
      }
      return a.label.localeCompare(b.label);
    });

    return groups;
  }, [filtered, groupBy, groupSort]);

  const selectedIssue = useMemo(
    () => filtered.find((issue) => issue.id === selectedIssueId) || issues.find((issue) => issue.id === selectedIssueId) || null,
    [filtered, issues, selectedIssueId],
  );

  const flattenedRows = useMemo((): FlattenedRow[] => {
    const rows: FlattenedRow[] = [];
    for (const group of grouped) {
      rows.push({ type: 'group-header', key: `h:${group.key}`, label: group.label, count: group.issues.length });
      for (const issue of group.issues) {
        rows.push({ type: 'issue', key: issue.id, issue });
      }
    }
    return rows;
  }, [grouped]);

  return (
    <section className="issues-workspace panel">
      <div className="issues-workspace-grid">
        <aside className="issues-sidebar">
          <div className="panel-title-row">
            <h2>Issues</h2>
            <span className="file-pill">{summary.total}</span>
          </div>

          <div className="issues-kpis">
            <article className="kpi-card"><h4>Total</h4><strong>{summary.total}</strong></article>
            <article className="kpi-card danger"><h4>Errors</h4><strong>{summary.errors}</strong></article>
            <article className="kpi-card warn"><h4>Warnings</h4><strong>{summary.warnings}</strong></article>
            <article className="kpi-card"><h4>Landsnet</h4><strong>{summary.landsnet}</strong></article>
            <article className="kpi-card"><h4>Unresolved</h4><strong>{summary.unresolved}</strong></article>
          </div>

          <div className="issues-filter-box" role="group" aria-labelledby="issues-filters-heading">
            <h3 id="issues-filters-heading">Filters</h3>
            <div className="filter-grid">
              <select className="input" value={filters.severity} aria-label="Severity filter" onChange={(e) => onFilterChange({ severity: e.target.value as ValidationFilters['severity'] })}>
                <option value="all">Severity: all</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <select className="input" value={filters.category} aria-label="Category filter" onChange={(e) => onFilterChange({ category: e.target.value as ValidationFilters['category'] })}>
                <option value="all">Category: all</option>
                <option value="syntax">Syntax</option>
                <option value="semantic">Semantic</option>
                <option value="interop">Interop</option>
              </select>
              <select className="input" value={filters.protocol} aria-label="Protocol filter" onChange={(e) => onFilterChange({ protocol: e.target.value as ValidationFilters['protocol'] })}>
                <option value="all">Protocol: all</option>
                <option value="GOOSE">GOOSE</option>
                <option value="SV">SV</option>
                <option value="REPORT">REPORT</option>
                <option value="Generic">Generic</option>
              </select>
              <select className="input" value={filters.status} aria-label="Status filter" onChange={(e) => onFilterChange({ status: e.target.value as ValidationFilters['status'] })}>
                <option value="all">Status: all</option>
                <option value="resolved">Resolved</option>
                <option value="unresolved">Unresolved</option>
              </select>
              <input className="input" value={filters.query} aria-label="Search issues by code, message or IED" onChange={(e) => onFilterChange({ query: e.target.value })} placeholder="Search code/message/IED" />
            </div>

            <div className="chip-group">
              <Chip active={onlyErrors} onClick={() => setOnlyErrors((v) => !v)}>Only errors</Chip>
              <Chip active={onlyLandsnet} onClick={() => setOnlyLandsnet((v) => !v)}>Only Landsnet</Chip>
              <Chip active={onlyDuplicates} onClick={() => setOnlyDuplicates((v) => !v)}>Only duplicates</Chip>
              <Chip active={onlyNetworkIds} onClick={() => setOnlyNetworkIds((v) => !v)}>Only IP/MAC/APPID</Chip>
            </div>
          </div>

          <div className="issues-filter-box" role="group" aria-labelledby="issues-grouping-heading">
            <h3 id="issues-grouping-heading">Grouping</h3>
            <div className="filter-grid">
              <select className="input" value={groupBy} aria-label="Group issues by" onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
                <option value="check">Group by check</option>
                <option value="ied">Group by IED</option>
                <option value="protocol">Group by protocol</option>
                <option value="category">Group by category</option>
              </select>
              <select className="input" value={groupSort} aria-label="Sort groups by" onChange={(e) => setGroupSort(e.target.value as GroupSort)}>
                <option value="count">Sort by count</option>
                <option value="severity">Sort by severity</option>
                <option value="code">Sort by code</option>
              </select>
            </div>
          </div>

          <div className="tabs-row wrap">
            <Button onClick={onExportJson}>Export validation JSON</Button>
            <Button onClick={onExportCsv}>Export validation CSV</Button>
            <Button onClick={onExportLandsnetJson}>Export Landsnet JSON</Button>
          </div>
        </aside>

        <section className="issues-main">
          <div className="issues-list-pane">
            <div className="panel-title-row">
              <h3>Grouped Issues</h3>
              <span className="file-pill">{filtered.length} shown</span>
            </div>

            {grouped.length === 0 ? <p className="hint">No issues match current filters.</p> : null}

            <div ref={listContainerRef} className="issues-group-list" role="region" aria-label="Grouped issues list">
              <VirtualList<FlattenedRow>
                items={flattenedRows}
                rowHeight={ISSUE_ROW_HEIGHT}
                height={listHeight}
                overscan={8}
                itemKey={(row) => row.key}
                renderRow={(row, _index) => {
                  if (row.type === 'group-header') {
                    return (
                      <div className="issues-group-card-header">
                        <strong>{row.label}</strong>
                        <span className="file-pill">{row.count}</span>
                      </div>
                    );
                  }
                  const { issue } = row;
                  return (
                    <button
                      type="button"
                      className={`issue-row ${selectedIssueId === issue.id ? 'active' : ''}`}
                      onClick={() => onSelectIssue(issue.id)}
                    >
                      <span className={`badge ${severityBadgeClass(issue.severity)}`}>{normalizeSeverity(issue.severity)}</span>
                      <span className="issue-row-title">[{issue.code}] {issue.message}</span>
                      <span className="hint">{issue.context.iedName || issue.entityRef.iedName || '-'}</span>
                    </button>
                  );
                }}
              />
            </div>
          </div>

          <aside className="issues-details-pane">
            <div className="panel-title-row">
              <h3>Issue Details</h3>
              {selectedIssue ? <span className="file-pill">{selectedIssue.code}</span> : null}
            </div>

            {selectedIssue ? (
              <>
                <article className="info-card">
                  <h4>Message</h4>
                  <p>{selectedIssue.message}</p>
                </article>

                <article className="info-card">
                  <h4>Meta</h4>
                  <p><strong>Severity:</strong> {normalizeSeverity(selectedIssue.severity)}</p>
                  <p><strong>Category:</strong> {selectedIssue.category}</p>
                  <p><strong>Protocol:</strong> {selectedIssue.protocol}</p>
                  <p><strong>Path:</strong> {selectedIssue.path}</p>
                  <p><strong>Fix hint:</strong> {selectedIssue.fixHint || selectedIssue.quickFix || '-'}</p>
                </article>

                <article className="info-card">
                  <h4>Context</h4>
                  <pre className="xml-snippet">{JSON.stringify(selectedIssue.context, null, 2)}</pre>
                </article>

                <div className="tabs-row wrap">
                  <Button onClick={() => void copyToClipboard(JSON.stringify(selectedIssue, null, 2))}>Copy issue JSON</Button>
                  {(selectedIssue.context.iedName || selectedIssue.entityRef.iedName) ? (
                    <Button variant="primary" onClick={() => onOpenInGraph(selectedIssue.id)}>Open in graph</Button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="hint">Select an issue to inspect details.</p>
            )}
          </aside>
        </section>
      </div>
    </section>
  );
}

function matchesSeverity(issue: ValidationIssue, filter: ValidationFilters['severity']): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'warn' || filter === 'warning') {
    return issue.severity === 'warn' || issue.severity === 'warning';
  }
  return issue.severity === filter;
}

function groupKey(issue: ValidationIssue, groupBy: GroupBy): string {
  if (groupBy === 'check') {
    const match = issue.code.match(/^LNET_\d{3}/);
    return match ? match[0] : issue.code;
  }
  if (groupBy === 'ied') {
    return issue.context.iedName || issue.entityRef.iedName || 'Unknown IED';
  }
  if (groupBy === 'protocol') {
    return issue.protocol;
  }
  return issue.category;
}

function severityRank(severity: ValidationIssue['severity']): number {
  if (severity === 'error') {
    return 3;
  }
  if (severity === 'warn' || severity === 'warning') {
    return 2;
  }
  return 1;
}

function maxSeverity(issues: ValidationIssue[]): ValidationIssue['severity'] {
  return [...issues].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]?.severity || 'info';
}

function normalizeSeverity(severity: ValidationIssue['severity']): 'error' | 'warning' | 'info' {
  if (severity === 'error') {
    return 'error';
  }
  if (severity === 'warn' || severity === 'warning') {
    return 'warning';
  }
  return 'info';
}

function severityBadgeClass(severity: ValidationIssue['severity']): string {
  const value = normalizeSeverity(severity);
  if (value === 'error') {
    return 'danger';
  }
  if (value === 'warning') {
    return 'goose';
  }
  return 'sv';
}
