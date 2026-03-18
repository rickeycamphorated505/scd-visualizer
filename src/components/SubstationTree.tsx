import { useMemo, useState } from 'react';
import type { IedModel, SubstationModel } from '../model/types';
import type { ValidationIssue } from '../validation/types';

interface SubstationTreeProps {
  substations: SubstationModel[];
  ieds: IedModel[];
  issues: ValidationIssue[];
  selectedIedName?: string;
  onSelectIed: (iedName: string) => void;
}

export default function SubstationTree({
  substations,
  ieds,
  issues,
  selectedIedName,
  onSelectIed,
}: SubstationTreeProps): JSX.Element {
  const [iedQuery, setIedQuery] = useState('');
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [expandedSubstations, setExpandedSubstations] = useState<Record<string, boolean>>({});
  const [expandedVoltageLevels, setExpandedVoltageLevels] = useState<Record<string, boolean>>({});

  // Issue count per IED
  const issuesByIed = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of issues) {
      const iedName = issue.entityRef.iedName ?? issue.context.iedName;
      if (iedName) {
        map.set(iedName, (map.get(iedName) ?? 0) + 1);
      }
    }
    return map;
  }, [issues]);

  // Issues for selected IED
  const selectedIedIssues = useMemo(() => {
    if (!selectedIedName) return issues;
    return issues.filter(
      (i) => (i.entityRef.iedName ?? i.context.iedName) === selectedIedName,
    );
  }, [issues, selectedIedName]);

  const filteredIeds = useMemo(() => {
    const q = iedQuery.trim().toLowerCase();
    const sorted = [...ieds].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
  }, [ieds, iedQuery]);

  function toggleSubstation(name: string) {
    setExpandedSubstations((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function toggleVoltageLevel(key: string) {
    setExpandedVoltageLevels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isSubstationExpanded(name: string): boolean {
    return expandedSubstations[name] !== false; // expanded by default
  }

  function isVoltageLevelExpanded(key: string): boolean {
    return expandedVoltageLevels[key] !== false; // expanded by default
  }

  function iedStatus(iedName: string): JSX.Element {
    const count = issuesByIed.get(iedName) ?? 0;
    if (count === 0) {
      return <span className="tree-ied-status pass">✓</span>;
    }
    return <span className="tree-ied-status fail">✗{count}</span>;
  }

  const hasSubstations = substations.length > 0;

  return (
    <aside className="panel substation-tree-panel">
      <div className="panel-title-row">
        <h2>Hierarchy</h2>
        <span className="file-pill">{ieds.length} IEDs</span>
      </div>

      <div className="search-wrap">
        <input
          className="input"
          placeholder="Filter IED…"
          value={iedQuery}
          onChange={(e) => setIedQuery(e.target.value)}
        />
        {iedQuery && (
          <button className="search-clear" onClick={() => setIedQuery('')} aria-label="Clear filter">
            ✕
          </button>
        )}
      </div>

      <div className="tree-scroll">
        {hasSubstations && !iedQuery ? (
          // Substation hierarchy
          substations.map((substation) => (
            <div key={substation.name} className="tree-substation">
              <button
                className="tree-node tree-substation-header"
                onClick={() => toggleSubstation(substation.name)}
              >
                <span className="tree-arrow">{isSubstationExpanded(substation.name) ? '▾' : '▸'}</span>
                <span className="tree-icon">⚡</span>
                <span className="tree-label">{substation.name}</span>
              </button>
              {isSubstationExpanded(substation.name) ? (
                substation.voltageLevels.map((vl) => {
                  const vlKey = `${substation.name}/${vl.name}`;
                  return (
                    <div key={vl.name} className="tree-voltage-level">
                      <button
                        className="tree-node tree-vl-header"
                        onClick={() => toggleVoltageLevel(vlKey)}
                      >
                        <span className="tree-arrow">{isVoltageLevelExpanded(vlKey) ? '▾' : '▸'}</span>
                        <span className="tree-icon">⬡</span>
                        <span className="tree-label">{vl.name}</span>
                        {vl.nomFreq ? <span className="tree-meta">{vl.nomFreq} Hz</span> : null}
                      </button>
                      {isVoltageLevelExpanded(vlKey) ? (
                        vl.bays.map((bay) => (
                          <div key={bay.name} className="tree-bay">
                            <div className="tree-node tree-bay-header">
                              <span className="tree-arrow tree-leaf">─</span>
                              <span className="tree-icon">▬</span>
                              <span className="tree-label">{bay.name}</span>
                            </div>
                            {bay.iedNames.map((iedName) => (
                              <button
                                key={iedName}
                                className={`tree-node tree-ied ${selectedIedName === iedName ? 'active' : ''}`}
                                onClick={() => onSelectIed(iedName)}
                              >
                                <span className="tree-arrow tree-leaf2">└</span>
                                <span className="tree-ied-name">{iedName}</span>
                                {iedStatus(iedName)}
                              </button>
                            ))}
                            {bay.iedNames.length === 0 ? (
                              <div className="tree-empty-bay">
                                <span className="tree-arrow tree-leaf2">└</span>
                                <span className="tree-meta">No IEDs</span>
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : null}
                    </div>
                  );
                })
              ) : null}
            </div>
          ))
        ) : (
          // Flat IED list (when no substations or filtering)
          <div className="tree-flat-ieds">
            {iedQuery && hasSubstations ? (
              <p className="hint tree-filter-hint">Filtered across all substations</p>
            ) : null}
            {filteredIeds.map((ied) => (
              <button
                key={ied.name}
                className={`tree-node tree-ied ${selectedIedName === ied.name ? 'active' : ''}`}
                onClick={() => onSelectIed(ied.name)}
              >
                <span className="tree-ied-name">{ied.name}</span>
                <span className="tree-ied-bay hint">
                  {ied.bayNames[0] ?? 'Unassigned'}
                </span>
                {iedStatus(ied.name)}
              </button>
            ))}
            {filteredIeds.length === 0 ? (
              <p className="hint">No IEDs match.</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Collapsible issues section */}
      <div className="tree-issues-section">
        <button
          className="tree-issues-header"
          onClick={() => setIssuesOpen((v) => !v)}
        >
          <span className="tree-arrow">{issuesOpen ? '▾' : '▸'}</span>
          <span>
            {selectedIedName ? `Issues: ${selectedIedName}` : 'All issues'}
          </span>
          {selectedIedIssues.length > 0 ? (
            <span className="file-pill issues-badge">{selectedIedIssues.length}</span>
          ) : (
            <span className="file-pill success-badge">✓</span>
          )}
        </button>
        {issuesOpen ? (
          <div className="tree-issues-list">
            {selectedIedIssues.length === 0 ? (
              <p className="hint">No issues{selectedIedName ? ` for ${selectedIedName}` : ''}.</p>
            ) : (
              selectedIedIssues.slice(0, 50).map((issue) => (
                <div key={issue.id} className={`tree-issue-row issue-sev-${issue.severity}`}>
                  <span className="tree-issue-code">{issue.code}</span>
                  <span className="tree-issue-msg">{issue.message}</span>
                </div>
              ))
            )}
            {selectedIedIssues.length > 50 ? (
              <p className="hint">{selectedIedIssues.length - 50} more issues…</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
