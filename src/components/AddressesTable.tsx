import { useMemo, useState } from 'react';
import type { SclModel } from '../model/types';

interface AddressRow {
  iedName: string;
  apName: string;
  ip: string;
  netmask: string;
  gateway: string;
  mac: string;
  gooseAppIds: string;
  svAppIds: string;
  vlanIds: string;
}

interface AddressesTableProps {
  model: SclModel;
}

export default function AddressesTable({ model }: AddressesTableProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo((): AddressRow[] => {
    const result: AddressRow[] = [];

    for (const subnet of model.subNetworks) {
      for (const cap of subnet.connectedAps) {
        const iedName = cap.iedName;
        const apName = cap.apName;

        // Collect GOOSE APPIDs for this IED
        const gooseAppIds = model.gseComms
          .filter((g) => g.iedName === iedName && g.apName === apName)
          .map((g) => g.appId)
          .filter(Boolean)
          .join(', ');

        // Collect SV APPIDs for this IED
        const svAppIds = model.smvComms
          .filter((s) => s.iedName === iedName && s.apName === apName)
          .map((s) => s.appId)
          .filter(Boolean)
          .join(', ');

        // Collect VLAN IDs (from GOOSE + SV)
        const vlanSet = new Set<string>();
        model.gseComms
          .filter((g) => g.iedName === iedName && g.apName === apName && g.vlanId)
          .forEach((g) => vlanSet.add(g.vlanId!));
        model.smvComms
          .filter((s) => s.iedName === iedName && s.apName === apName && s.vlanId)
          .forEach((s) => vlanSet.add(s.vlanId!));

        // Get MAC from gseComms (first entry for this IED/AP)
        const gseComm = model.gseComms.find((g) => g.iedName === iedName && g.apName === apName);
        const mac = gseComm?.mac ?? '';

        result.push({
          iedName,
          apName,
          ip: cap.ip ?? '',
          netmask: cap.netmask ?? '',
          gateway: cap.gateway ?? '',
          mac,
          gooseAppIds,
          svAppIds,
          vlanIds: Array.from(vlanSet).join(', '),
        });
      }
    }

    return result;
  }, [model]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((row) => row.iedName.toLowerCase().includes(q))
      : rows;
    return [...filtered].sort((a, b) => {
      const cmp = a.iedName.localeCompare(b.iedName);
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, query, sortAsc]);

  return (
    <section className="panel" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Addresses</h2>
        <input
          className="input"
          placeholder="Filter by IED name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <span className="hint">{filtered.length} of {rows.length} entries</span>
      </div>
      <div style={{ flex: '1 1 0', overflow: 'auto' }}>
        <table className="stats-table" style={{ tableLayout: 'fixed', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortAsc((v) => !v)}>
                IED Name {sortAsc ? '▲' : '▼'}
              </th>
              <th>AP</th>
              <th>IP</th>
              <th>Netmask</th>
              <th>Gateway</th>
              <th>MAC</th>
              <th>GOOSE APPIDs</th>
              <th>SV APPIDs</th>
              <th>VLAN IDs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="hint" style={{ textAlign: 'center', padding: '24px' }}>No entries found.</td></tr>
            ) : filtered.map((row, idx) => (
              <tr key={`${row.iedName}:${row.apName}:${idx}`}>
                <td>{row.iedName}</td>
                <td>{row.apName}</td>
                <td>{row.ip}</td>
                <td>{row.netmask}</td>
                <td>{row.gateway}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{row.mac}</td>
                <td>{row.gooseAppIds}</td>
                <td>{row.svAppIds}</td>
                <td>{row.vlanIds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
