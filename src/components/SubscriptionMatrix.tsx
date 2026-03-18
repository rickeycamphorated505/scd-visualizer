import { useMemo } from 'react';
import type { EdgeModel, IedModel } from '../model/types';

interface SubscriptionMatrixProps {
  edges: EdgeModel[];
  ieds: IedModel[];
  onFilterEdges: (publisherIed: string, subscriberIed: string) => void;
}

interface CellData {
  goose: number;
  sv: number;
  total: number;
}

export default function SubscriptionMatrix({ edges, ieds: _ieds, onFilterEdges }: SubscriptionMatrixProps): JSX.Element {
  const publishers = useMemo(
    () => [...new Set(edges.map((e) => e.publisherIed))].sort((a, b) => a.localeCompare(b)),
    [edges],
  );

  const subscribers = useMemo(
    () => [...new Set(edges.map((e) => e.subscriberIed))].sort((a, b) => a.localeCompare(b)),
    [edges],
  );

  // Build cell map: publisher -> subscriber -> { goose, sv, total }
  const cellMap = useMemo(() => {
    const map = new Map<string, Map<string, CellData>>();
    for (const edge of edges) {
      if (!map.has(edge.publisherIed)) {
        map.set(edge.publisherIed, new Map());
      }
      const subMap = map.get(edge.publisherIed)!;
      const existing = subMap.get(edge.subscriberIed) ?? { goose: 0, sv: 0, total: 0 };
      subMap.set(edge.subscriberIed, {
        goose: existing.goose + (edge.signalType === 'GOOSE' ? 1 : 0),
        sv: existing.sv + (edge.signalType === 'SV' ? 1 : 0),
        total: existing.total + 1,
      });
    }
    return map;
  }, [edges]);

  if (edges.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <p className="hint">No subscription edges to display.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto', padding: '8px' }}>
      <p className="hint" style={{ marginBottom: 8 }}>
        Click a cell to filter the graph to show only that publisher–subscriber pair.
        Rows = publishers, columns = subscribers.
      </p>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', top: 0, left: 0,
                background: 'var(--surface)',
                zIndex: 3,
                padding: '4px 8px',
                border: '1px solid var(--line)',
                minWidth: 120,
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
                  const cell = cellMap.get(pub)?.get(sub);
                  if (!cell || cell.total === 0) {
                    return (
                      <td
                        key={sub}
                        style={{
                          border: '1px solid var(--line)',
                          padding: '2px',
                          textAlign: 'center',
                          minWidth: 32,
                          color: 'var(--text-muted)',
                        }}
                      >
                        ·
                      </td>
                    );
                  }
                  // Color: GOOSE only = purple, SV only = orange, mixed = blue
                  const color = cell.goose > 0 && cell.sv > 0
                    ? 'var(--mms, #0e5ea8)'
                    : cell.goose > 0
                    ? 'var(--goose, #c41e1e)'
                    : 'var(--sv, #b45309)';
                  return (
                    <td
                      key={sub}
                      onClick={() => onFilterEdges(pub, sub)}
                      title={`${pub} → ${sub}: ${cell.goose} GOOSE, ${cell.sv} SV`}
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
                      {cell.total}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
