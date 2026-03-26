import { useMemo, useState } from 'react';
import type { EdgeModel, IedModel } from '../model/types';

type Protocol = 'GOOSE' | 'SV' | 'REPORT';

interface SubscriptionMatrixProps {
  edges: EdgeModel[];
  ieds: IedModel[];
  onFilterEdges: (publisherIed: string, subscriberIed: string) => void;
}

const PROTOCOL_TABS: { id: Protocol; label: string; color: string }[] = [
  { id: 'GOOSE',  label: 'GOOSE',   color: 'var(--goose, #c41e1e)' },
  { id: 'SV',     label: 'Sampled Values', color: 'var(--sv, #b45309)' },
  { id: 'REPORT', label: 'Reports', color: 'var(--mms, #0e5ea8)' },
];

export default function SubscriptionMatrix({ edges, ieds: _ieds, onFilterEdges }: SubscriptionMatrixProps): JSX.Element {
  const [protocol, setProtocol] = useState<Protocol>('GOOSE');

  const filteredEdges = useMemo(
    () => edges.filter((e) => e.signalType === protocol),
    [edges, protocol],
  );

  const publishers = useMemo(
    () => [...new Set(filteredEdges.map((e) => e.publisherIed))].sort((a, b) => a.localeCompare(b)),
    [filteredEdges],
  );

  const subscribers = useMemo(
    () => [...new Set(filteredEdges.map((e) => e.subscriberIed))].sort((a, b) => a.localeCompare(b)),
    [filteredEdges],
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const edge of filteredEdges) {
      if (!map.has(edge.publisherIed)) map.set(edge.publisherIed, new Map());
      const subMap = map.get(edge.publisherIed)!;
      subMap.set(edge.subscriberIed, (subMap.get(edge.subscriberIed) ?? 0) + 1);
    }
    return map;
  }, [filteredEdges]);

  const activeTab = PROTOCOL_TABS.find((t) => t.id === protocol)!;

  return (
    <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Protocol sub-tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        {PROTOCOL_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`center-view-btn ${protocol === tab.id ? 'active' : ''}`}
            onClick={() => setProtocol(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <span className="hint" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          {filteredEdges.length} connections · rows = publishers, columns = subscribers
        </span>
      </div>

      {filteredEdges.length === 0 ? (
        <div style={{ padding: 24 }}>
          <p className="hint">No {activeTab.label} subscriptions found.</p>
        </div>
      ) : (
        <div style={{ flex: '1 1 0', overflow: 'auto', padding: '8px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', top: 0, left: 0,
                  background: 'var(--surface)',
                  zIndex: 3,
                  padding: '4px 8px',
                  border: '1px solid var(--line)',
                  minWidth: 140,
                  textAlign: 'left',
                }}>
                  Publisher ↓ / Subscriber →
                </th>
                {subscribers.map((sub) => (
                  <th
                    key={sub}
                    title={sub}
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: 'var(--surface)',
                      zIndex: 2,
                      padding: '2px 4px',
                      border: '1px solid var(--line)',
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      maxHeight: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '10px',
                      cursor: 'default',
                    }}
                  >
                    {sub}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {publishers.map((pub) => (
                <tr key={pub}>
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    background: 'var(--surface)',
                    zIndex: 1,
                    padding: '2px 8px',
                    border: '1px solid var(--line)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {pub}
                  </td>
                  {subscribers.map((sub) => {
                    const count = cellMap.get(pub)?.get(sub) ?? 0;
                    if (count === 0) {
                      return (
                        <td key={sub} style={{
                          border: '1px solid var(--line)',
                          padding: '2px',
                          textAlign: 'center',
                          minWidth: 32,
                          color: 'var(--text-muted)',
                        }}>·</td>
                      );
                    }
                    const color = activeTab.color;
                    return (
                      <td
                        key={sub}
                        onClick={() => onFilterEdges(pub, sub)}
                        title={`${pub} → ${sub}: ${count} ${protocol}`}
                        style={{
                          border: '1px solid var(--line)',
                          padding: '2px',
                          textAlign: 'center',
                          minWidth: 32,
                          cursor: 'pointer',
                          background: `${color}22`,
                          color,
                          fontWeight: 600,
                          fontSize: '11px',
                        }}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
