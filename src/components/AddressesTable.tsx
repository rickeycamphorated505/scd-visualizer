import { Fragment, useMemo, useState } from 'react';
import type { SclModel } from '../model/types';

type SubView = 'ip' | 'goose' | 'sv' | 'reports' | 'signals';
type ProtocolFilter = 'GOOSE' | 'SV' | 'REPORT';

interface AddressesTableProps {
  model: SclModel;
}

const ALL_PROTOCOLS: ProtocolFilter[] = ['GOOSE', 'SV', 'REPORT'];

export default function AddressesTable({ model }: AddressesTableProps): JSX.Element {
  const [subView, setSubView] = useState<SubView>('ip');
  const [query, setQuery] = useState('');
  const [protocols, setProtocols] = useState<Set<ProtocolFilter>>(new Set(ALL_PROTOCOLS));

  function toggleProtocol(p: ProtocolFilter) {
    setProtocols((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next.size === 0 ? new Set(ALL_PROTOCOLS) : next;
    });
  }

  return (
    <section className="panel" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Addresses</h2>
        <div className="sub-view-switcher">
          <button className={`sub-view-btn${subView === 'ip' ? ' sub-view-active' : ''}`} onClick={() => setSubView('ip')}>IP Addresses</button>
          <button className={`sub-view-btn${subView === 'goose' ? ' sub-view-active' : ''}`} onClick={() => setSubView('goose')}>GOOSE</button>
          <button className={`sub-view-btn${subView === 'sv' ? ' sub-view-active' : ''}`} onClick={() => setSubView('sv')}>Sampled Values</button>
          <button className={`sub-view-btn${subView === 'reports' ? ' sub-view-active' : ''}`} onClick={() => setSubView('reports')}>Reports</button>
          <button className={`sub-view-btn${subView === 'signals' ? ' sub-view-active' : ''}`} onClick={() => setSubView('signals')}>Merki</button>
        </div>
        {subView === 'signals' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`sub-view-btn${protocols.has('GOOSE') ? ' sub-view-active' : ''}`}
              style={{ color: 'var(--goose)', borderColor: protocols.has('GOOSE') ? 'var(--goose)' : undefined }}
              onClick={() => toggleProtocol('GOOSE')}
            >● GOOSE</button>
            <button
              className={`sub-view-btn${protocols.has('SV') ? ' sub-view-active' : ''}`}
              style={{ color: 'var(--sv)', borderColor: protocols.has('SV') ? 'var(--sv)' : undefined }}
              onClick={() => toggleProtocol('SV')}
            >● SMV</button>
            <button
              className={`sub-view-btn${protocols.has('REPORT') ? ' sub-view-active' : ''}`}
              style={{ color: 'var(--mms)', borderColor: protocols.has('REPORT') ? 'var(--mms)' : undefined }}
              onClick={() => toggleProtocol('REPORT')}
            >● Report</button>
          </div>
        )}
        <input
          className="input"
          placeholder="Filter by IED name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 220, marginLeft: 'auto' }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: '1 1 0', overflow: 'auto' }}>
        {subView === 'ip'      && <IpView      model={model} query={query} />}
        {subView === 'goose'   && <GooseView   model={model} query={query} />}
        {subView === 'sv'      && <SvView      model={model} query={query} />}
        {subView === 'reports' && <ReportsView model={model} query={query} />}
        {subView === 'signals' && <SignalsView model={model} query={query} protocols={protocols} />}
      </div>
    </section>
  );
}

/* ── IP Addresses ─────────────────────────────────────────────────── */

function IpView({ model, query }: { model: SclModel; query: string }): JSX.Element {
  const q = query.trim().toLowerCase();

  // All subnetworks in file order
  const subnets = model.subNetworks;

  // Build pivot: iedName → subnetName → ConnectedApModel
  const { iedNames, lookup } = useMemo(() => {
    const lookup = new Map<string, Map<string, { apName: string; ip?: string; netmask?: string; gateway?: string }>>();
    for (const sn of subnets) {
      for (const cap of sn.connectedAps) {
        if (!lookup.has(cap.iedName)) lookup.set(cap.iedName, new Map());
        lookup.get(cap.iedName)!.set(sn.name, { apName: cap.apName, ip: cap.ip, netmask: cap.netmask, gateway: cap.gateway });
      }
    }
    const iedNames = [...lookup.keys()]
      .filter((n) => !q || n.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b));
    return { iedNames, lookup };
  }, [subnets, q]);

  if (iedNames.length === 0) {
    return <EmptyHint />;
  }

  return (
    <table className="stats-table addr-table">
      <thead>
        {/* Row 1: subnet group headers */}
        <tr>
          <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>IED Name</th>
          {subnets.map((sn) => (
            <th key={sn.name} colSpan={3} className="addr-sn-group-header">
              {sn.name}
              {sn.type && <span className="addr-subnet-type"> {sn.type}</span>}
            </th>
          ))}
        </tr>
        {/* Row 2: per-subnet column labels */}
        <tr>
          {subnets.map((sn) => (
            <Fragment key={sn.name}>
              <th className="addr-sub-col">Access Point</th>
              <th className="addr-sub-col">IP Address</th>
              <th className="addr-sub-col">Netmask</th>
              <th className="addr-sub-col">Gateway</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {iedNames.map((iedName) => {
          const snMap = lookup.get(iedName)!;
          return (
            <tr key={iedName}>
              <td className="addr-ied-name">{iedName}</td>
              {subnets.map((sn) => {
                const entry = snMap.get(sn.name);
                return (
                  <Fragment key={sn.name}>
                    <td className="mono">{entry?.apName ?? '—'}</td>
                    <td className={`mono${entry?.ip ? ' addr-ip' : ''}`}>{entry?.ip ?? '—'}</td>
                    <td className="mono">{entry?.netmask ?? '—'}</td>
                    <td className="mono">{entry?.gateway ?? '—'}</td>
                  </Fragment>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── GOOSE ────────────────────────────────────────────────────────── */

function GooseView({ model, query }: { model: SclModel; query: string }): JSX.Element {
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const commIndex = new Map(model.gseComms.map((c) => [`${c.iedName}:${c.cbName}`, c]));
    return model.gseControls
      .filter((gc) => !q || gc.iedName.toLowerCase().includes(q))
      .sort((a, b) => a.iedName.localeCompare(b.iedName) || a.name.localeCompare(b.name))
      .map((gc) => ({ gc, comm: commIndex.get(`${gc.iedName}:${gc.name}`) }));
  }, [model.gseControls, model.gseComms, q]);

  if (rows.length === 0) {
    return <EmptyHint />;
  }

  return (
    <table className="stats-table addr-table">
      <thead>
        <tr>
          <th>IED</th>
          <th>Control Block</th>
          <th>Dataset</th>
          <th>MAC Address</th>
          <th>APPID</th>
          <th>VLAN ID</th>
          <th>VLAN Prio</th>
          <th>MinTime</th>
          <th>MaxTime</th>
          <th>confRev</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ gc, comm }, i) => (
          <tr key={`${gc.iedName}-${gc.name}-${i}`}>
            <td className="addr-ied-name">{gc.iedName}</td>
            <td className="mono">{gc.name}</td>
            <td className="mono">{gc.datSet ?? '—'}</td>
            <td className="mono addr-mac">{comm?.mac ?? '—'}</td>
            <td className="mono">{comm?.appId ?? '—'}</td>
            <td className="mono">{comm?.vlanId ?? '—'}</td>
            <td className="mono">{comm?.vlanPriority ?? '—'}</td>
            <td className="mono">{comm?.minTime != null ? `${comm.minTime} ms` : '—'}</td>
            <td className="mono">{comm?.maxTime != null ? `${comm.maxTime} ms` : '—'}</td>
            <td className="mono">{gc.confRev ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Sampled Values ───────────────────────────────────────────────── */

function SvView({ model, query }: { model: SclModel; query: string }): JSX.Element {
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const commIndex = new Map(model.smvComms.map((c) => [`${c.iedName}:${c.cbName}`, c]));
    return model.svControls
      .filter((sv) => !q || sv.iedName.toLowerCase().includes(q))
      .sort((a, b) => a.iedName.localeCompare(b.iedName) || a.name.localeCompare(b.name))
      .map((sv) => ({ sv, comm: commIndex.get(`${sv.iedName}:${sv.name}`) }));
  }, [model.svControls, model.smvComms, q]);

  if (rows.length === 0) {
    return <EmptyHint />;
  }

  return (
    <table className="stats-table addr-table">
      <thead>
        <tr>
          <th>IED</th>
          <th>Control Block</th>
          <th>Dataset</th>
          <th>MAC Address</th>
          <th>APPID</th>
          <th>VLAN ID</th>
          <th>VLAN Prio</th>
          <th>Smp Rate</th>
          <th>noASDU</th>
          <th>confRev</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ sv, comm }, i) => (
          <tr key={`${sv.iedName}-${sv.name}-${i}`}>
            <td className="addr-ied-name">{sv.iedName}</td>
            <td className="mono">{sv.name}</td>
            <td className="mono">{sv.datSet ?? '—'}</td>
            <td className="mono addr-mac">{comm?.mac ?? '—'}</td>
            <td className="mono">{comm?.appId ?? '—'}</td>
            <td className="mono">{comm?.vlanId ?? '—'}</td>
            <td className="mono">{comm?.vlanPriority ?? '—'}</td>
            <td className="mono">{comm?.smpRate ?? sv.smpRate ?? '—'}</td>
            <td className="mono">{comm?.nofASDU ?? sv.nofASDU ?? '—'}</td>
            <td className="mono">{sv.confRev ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Reports ──────────────────────────────────────────────────────── */

function ReportsView({ model, query }: { model: SclModel; query: string }): JSX.Element {
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return model.reportControls
      .filter((rc) => !q || rc.iedName.toLowerCase().includes(q))
      .sort((a, b) => a.iedName.localeCompare(b.iedName) || a.name.localeCompare(b.name));
  }, [model.reportControls, q]);

  if (rows.length === 0) {
    return <EmptyHint />;
  }

  return (
    <table className="stats-table addr-table">
      <thead>
        <tr>
          <th>IED</th>
          <th>Control Block</th>
          <th>Dataset</th>
          <th>Report ID</th>
          <th>Type</th>
          <th>Indexed</th>
          <th>confRev</th>
          <th>Clients</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((rc, i) => (
          <tr key={`${rc.iedName}-${rc.name}-${i}`}>
            <td className="addr-ied-name">{rc.iedName}</td>
            <td className="mono">{rc.name}</td>
            <td className="mono">{rc.datSet ?? '—'}</td>
            <td className="mono">{rc.rptId ?? '—'}</td>
            <td>
              <span className={`addr-report-type ${rc.buffered ? 'addr-buffered' : 'addr-unbuffered'}`}>
                {rc.buffered ? 'Buffered' : 'Unbuffered'}
              </span>
            </td>
            <td className="mono">{rc.indexed == null ? '—' : rc.indexed ? 'true' : 'false'}</td>
            <td className="mono">{rc.confRev ?? '—'}</td>
            <td className="mono">{rc.clients.length > 0 ? rc.clients.length : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Merki (Signals) ──────────────────────────────────────────────── */

const PROTOCOL_COLOR: Record<ProtocolFilter, string> = {
  GOOSE: 'var(--goose)',
  SV: 'var(--sv)',
  REPORT: 'var(--mms)',
};

function fcdaPath(fcda: { ldInst?: string; prefix?: string; lnClass?: string; lnInst?: string; doName?: string; daName?: string }): string {
  return [fcda.ldInst, fcda.prefix ? `${fcda.prefix}${fcda.lnClass}` : fcda.lnClass, fcda.lnInst, fcda.doName, fcda.daName]
    .filter(Boolean)
    .join('/');
}

function SignalsView({ model, query, protocols }: { model: SclModel; query: string; protocols: Set<ProtocolFilter> }): JSX.Element {
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const dsIndex = new Map<string, typeof model.dataSets[0]>();
    for (const ds of model.dataSets) {
      dsIndex.set(`${ds.iedName}:${ds.name}`, ds);
    }

    type Row = { protocol: ProtocolFilter; ied: string; cb: string; dataset: string; path: string; fc: string };
    const result: Row[] = [];

    const controls: Array<{ iedName: string; name: string; datSet?: string; type: ProtocolFilter }> = [
      ...model.gseControls.map((c) => ({ ...c, type: 'GOOSE' as const })),
      ...model.svControls.map((c) => ({ ...c, type: 'SV' as const })),
      ...model.reportControls.map((c) => ({ ...c, type: 'REPORT' as const })),
    ];

    for (const ctrl of controls) {
      if (!protocols.has(ctrl.type)) continue;
      if (q && !ctrl.iedName.toLowerCase().includes(q)) continue;
      if (!ctrl.datSet) continue;
      const ds = dsIndex.get(`${ctrl.iedName}:${ctrl.datSet}`);
      if (!ds) continue;
      for (const fcda of ds.fcdas) {
        result.push({ protocol: ctrl.type, ied: ctrl.iedName, cb: ctrl.name, dataset: ctrl.datSet, path: fcdaPath(fcda), fc: fcda.fc ?? '' });
      }
    }

    result.sort((a, b) => a.ied.localeCompare(b.ied) || a.cb.localeCompare(b.cb));
    return result;
  }, [model.gseControls, model.svControls, model.reportControls, model.dataSets, protocols, q]);

  const counts = useMemo(() => ({
    GOOSE: rows.filter((r) => r.protocol === 'GOOSE').length,
    SV: rows.filter((r) => r.protocol === 'SV').length,
    REPORT: rows.filter((r) => r.protocol === 'REPORT').length,
  }), [rows]);

  if (rows.length === 0) return <EmptyHint />;

  return (
    <>
      <table className="stats-table addr-table">
        <thead>
          <tr>
            <th style={{ width: 12 }}></th>
            <th>IED</th>
            <th>Control Block</th>
            <th>Dataset</th>
            <th>FCDA merki</th>
            <th style={{ width: 48 }}>FC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center', color: PROTOCOL_COLOR[row.protocol] }}>●</td>
              <td className="addr-ied-name">{row.ied}</td>
              <td className="mono">{row.cb}</td>
              <td className="mono" style={{ color: 'var(--text-muted)' }}>{row.dataset}</td>
              <td className="mono">{row.path}</td>
              <td className="mono" style={{ color: 'var(--text-muted)' }}>{row.fc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: 11, borderTop: '1px solid var(--line)' }}>
        {rows.length} merki
        {' · '}
        <span style={{ color: 'var(--goose)' }}>GOOSE: {counts.GOOSE}</span>
        {' · '}
        <span style={{ color: 'var(--sv)' }}>SMV: {counts.SV}</span>
        {' · '}
        <span style={{ color: 'var(--mms)' }}>Report: {counts.REPORT}</span>
      </div>
    </>
  );
}

function EmptyHint(): JSX.Element {
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <p className="hint">No entries found.</p>
    </div>
  );
}
