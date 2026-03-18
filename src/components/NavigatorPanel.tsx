import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataSetModel, EdgeModel, IedModel } from '../model/types';
import type { DerivedIssue } from '../utils/graphVisibility';
import { Chip, Tabs } from './ui';
import VirtualList from './network/VirtualList';

const VIRTUALIZE_THRESHOLD = 100;
const IED_ROW_HEIGHT = 56;
const ISSUE_ROW_HEIGHT = 72;

function useContainerHeight(ref: React.RefObject<HTMLElement>): number {
  const [height, setHeight] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight || 400);
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

interface NavigatorPanelProps {
  ieds: IedModel[];
  dataSets: DataSetModel[];
  selectedKey?: string;
  onSelectIed: (iedName: string) => void;
  onSelectDataSet: (datasetKey: string, iedName: string) => void;
  flows: EdgeModel[];
  issues: DerivedIssue[];
  onSelectFlow: (edge: EdgeModel) => void;
}

export default function NavigatorPanel({
  ieds,
  dataSets,
  selectedKey,
  onSelectIed,
  onSelectDataSet,
  flows,
  issues,
  onSelectFlow,
}: NavigatorPanelProps): JSX.Element {
  const [tab, setTab] = useState<'ieds' | 'datasets' | 'flows' | 'issues'>('ieds');
  const [iedQuery, setIedQuery] = useState('');
  const [flowQuery, setFlowQuery] = useState('');
  const [flowProtocol, setFlowProtocol] = useState<'all' | 'GOOSE' | 'SV' | 'REPORT'>('all');

  const iedListRef = useRef<HTMLDivElement>(null);
  const issueListRef = useRef<HTMLDivElement>(null);
  const iedListHeight = useContainerHeight(iedListRef);
  const issueListHeight = useContainerHeight(issueListRef);

  const filteredIeds = useMemo(() => {
    const q = iedQuery.trim().toLowerCase();
    const list = [...ieds].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) {
      return list;
    }
    return list.filter((ied) => ied.name.toLowerCase().includes(q));
  }, [ieds, iedQuery]);

  const dataSetGroups = useMemo(() => {
    const map = new Map<string, DataSetModel[]>();
    for (const ds of dataSets) {
      if (!map.has(ds.iedName)) {
        map.set(ds.iedName, []);
      }
      map.get(ds.iedName)!.push(ds);
    }
    return Array.from(map.entries())
      .map(([iedName, list]) => ({
        iedName,
        dataSets: list.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.iedName.localeCompare(b.iedName));
  }, [dataSets]);

  const filteredFlows = useMemo(() => {
    let list = flows;
    if (flowProtocol !== 'all') {
      list = list.filter((e) => e.signalType === flowProtocol);
    }
    const q = flowQuery.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((edge) =>
      `${edge.publisherIed} ${edge.subscriberIed} ${edge.signalType} ${edge.controlBlockName || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [flows, flowQuery, flowProtocol]);

  const flowsByProtocol = useMemo((): { type: 'GOOSE' | 'SV' | 'REPORT'; edges: EdgeModel[] }[] => {
    const groups = [
      { type: 'GOOSE' as const, edges: filteredFlows.filter((e) => e.signalType === 'GOOSE') },
      { type: 'SV' as const, edges: filteredFlows.filter((e) => e.signalType === 'SV') },
      { type: 'REPORT' as const, edges: filteredFlows.filter((e) => e.signalType === 'REPORT') },
    ].filter((g) => g.edges.length > 0);
    return groups;
  }, [filteredFlows]);

  return (
    <aside className="panel navigator-panel">
      <div className="panel-title-row">
        <h2>Navigator</h2>
      </div>
      <Tabs<'ieds' | 'datasets' | 'flows' | 'issues'>
        aria-label="Navigator sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'ieds', label: 'IEDs' },
          { value: 'datasets', label: 'DataSets' },
          { value: 'flows', label: 'Flows', badge: flows.length > 0 ? flows.length : undefined },
          { value: 'issues', label: 'Issues', badge: issues.length > 0 ? issues.length : undefined },
        ]}
      />

      {tab === 'ieds' ? (
        <div className="tab-content">
          <div className="search-wrap">
            <input
              className="input"
              placeholder="Filter IED"
              value={iedQuery}
              onChange={(e) => setIedQuery(e.target.value)}
            />
            {iedQuery && (
              <button className="search-clear" onClick={() => setIedQuery('')} aria-label="Clear IED filter">
                ✕
              </button>
            )}
          </div>
          <div className="ied-list" ref={iedListRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {filteredIeds.length === 0 ? (
              <p className="hint">No IED matches.</p>
            ) : filteredIeds.length > VIRTUALIZE_THRESHOLD ? (
              <VirtualList
                items={filteredIeds}
                rowHeight={IED_ROW_HEIGHT}
                height={iedListHeight}
                itemKey={(ied) => ied.name}
                renderRow={(ied) => (
                  <button
                    className={`ied-item ${selectedKey === `ied:${ied.name}` ? 'active' : ''}`}
                    onClick={() => onSelectIed(ied.name)}
                  >
                    <strong>{ied.name}</strong>
                    <span className="hint">{ied.bayNames[0] || 'Unassigned'}</span>
                  </button>
                )}
              />
            ) : (
              filteredIeds.map((ied) => (
                <button
                  key={ied.name}
                  className={`ied-item ${selectedKey === `ied:${ied.name}` ? 'active' : ''}`}
                  onClick={() => onSelectIed(ied.name)}
                >
                  <strong>{ied.name}</strong>
                  <span className="hint">{ied.bayNames[0] || 'Unassigned'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === 'datasets' ? (
        <div className="tab-content">
          <p className="hint">Deep drill-down by IED and DataSet.</p>
          <div className="dataset-groups">
            {dataSetGroups.map((group) => (
              <div key={group.iedName} className="dataset-group">
                <button className="dataset-group-title" onClick={() => onSelectIed(group.iedName)}>
                  {group.iedName}
                </button>
                <div className="dataset-list">
                  {group.dataSets.map((ds) => (
                    <button
                      key={ds.key}
                      className={`dataset-item ${selectedKey === ds.key ? 'active' : ''}`}
                      onClick={() => onSelectDataSet(ds.key, group.iedName)}
                    >
                      {ds.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {dataSetGroups.length === 0 ? <p className="hint">No DataSet entries.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'flows' ? (
        <div className="tab-content flow-tab-content">
          <p className="hint">Select a flow to highlight it in the graph.</p>
          <div className="flow-filters">
            <div className="search-wrap">
              <input
                className="input"
                type="search"
                placeholder="Search by IED or control block"
                value={flowQuery}
                onChange={(e) => setFlowQuery(e.target.value)}
                aria-label="Filter flows by IED or control block"
              />
              {flowQuery && (
                <button className="search-clear" onClick={() => setFlowQuery('')} aria-label="Clear flow search">
                  ✕
                </button>
              )}
            </div>
            <div className="chip-group flow-protocol-chips">
              <Chip active={flowProtocol === 'all'} onClick={() => setFlowProtocol('all')}>All</Chip>
              <Chip active={flowProtocol === 'GOOSE'} onClick={() => setFlowProtocol('GOOSE')}>GOOSE</Chip>
              <Chip active={flowProtocol === 'SV'} onClick={() => setFlowProtocol('SV')}>SV</Chip>
              <Chip active={flowProtocol === 'REPORT'} onClick={() => setFlowProtocol('REPORT')}>REPORT</Chip>
            </div>
          </div>
          <div className="flow-list-header" aria-live="polite">
            {filteredFlows.length === flows.length
              ? `${filteredFlows.length} flow${filteredFlows.length !== 1 ? 's' : ''}`
              : `${filteredFlows.length} of ${flows.length} flows shown`}
          </div>
          <div className="flow-list" role="list">
            {flowsByProtocol.length === 0 ? (
              <div className="flow-empty-state">
                <p className="hint">
                  {flows.length === 0
                    ? 'No flows in current view. Adjust filters (GOOSE/SV/REPORT) in the toolbar.'
                    : 'No flows match the current filter. Try another search or show All protocols.'}
                </p>
              </div>
            ) : (
              flowsByProtocol.map((group) => (
                <div key={group.type} className="flow-group" role="group" aria-labelledby={`flow-group-${group.type}`}>
                  <h3 id={`flow-group-${group.type}`} className="flow-group-title">
                    {group.type} <span className="flow-group-count">({group.edges.length})</span>
                  </h3>
                  <ul className="flow-group-list">
                    {group.edges.map((edge) => (
                      <li key={edge.key}>
                        <button
                          type="button"
                          className={`flow-item ${selectedKey === edge.key ? 'active' : ''}`}
                          onClick={() => onSelectFlow(edge)}
                          aria-current={selectedKey === edge.key ? 'true' : undefined}
                          aria-label={`${edge.signalType} flow: ${edge.publisherIed} to ${edge.subscriberIed}${edge.controlBlockName ? `, ${edge.controlBlockName}` : ''}, ${edge.status}`}
                        >
                          <span className="flow-item-main">
                            <span className={`badge ${edge.signalType.toLowerCase()}`}>{edge.signalType}</span>
                            <span className="flow-item-route">{edge.publisherIed} → {edge.subscriberIed}</span>
                          </span>
                          <span className="flow-item-meta">
                            {edge.controlBlockName ? <span className="flow-item-cb">{edge.controlBlockName}</span> : null}
                            <span className={`status status-${edge.status}`}>{edge.status}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === 'issues' ? (
        <div className="tab-content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="issues-list" ref={issueListRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {issues.length === 0 ? (
              <p className="hint">No issues in current view.</p>
            ) : issues.length > VIRTUALIZE_THRESHOLD ? (
              <VirtualList
                items={issues}
                rowHeight={ISSUE_ROW_HEIGHT}
                height={issueListHeight}
                itemKey={(issue) => issue.id}
                renderRow={(issue) => (
                  <div className={`issue-card ${issue.severity}`}>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                )}
              />
            ) : (
              issues.map((issue) => (
                <div key={issue.id} className={`issue-card ${issue.severity}`}>
                  <strong>{issue.title}</strong>
                  <p>{issue.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
