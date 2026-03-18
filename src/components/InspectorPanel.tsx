import { useMemo, useState } from 'react';
import type { DataTypeTemplatesModel, EdgeModel, FcdaModel, SclModel } from '../model/types';
import type { SelectedEntity } from '../state/uiStore';
import type { Change } from '../diff/types';
import { Button } from './ui';

interface InspectorPanelProps {
  model?: SclModel;
  selectedEntity: SelectedEntity;
  selectedChange?: Change | null;
  baselineModel?: SclModel;
  onShowToast?: (message: string) => void;
}

export default function InspectorPanel({ model, selectedEntity, selectedChange, baselineModel, onShowToast }: InspectorPanelProps): JSX.Element {
  const [tab, setTab] = useState<'summary' | 'dataset' | 'diff' | 'xml' | 'unresolved'>('summary');
  const [fcdaQuery, setFcdaQuery] = useState('');

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      onShowToast?.('Copied to clipboard');
    } catch {
      onShowToast?.('Copy failed — check browser permissions');
    }
  }

  const resolved = useMemo(() => resolveEntity(model, baselineModel, selectedEntity), [model, baselineModel, selectedEntity]);
  const filteredFcdas = useMemo(() => {
    const q = fcdaQuery.trim().toLowerCase();
    if (!q || !resolved.fcdas) {
      return resolved.fcdas || [];
    }
    return resolved.fcdas.filter((fcda) => JSON.stringify(fcda).toLowerCase().includes(q));
  }, [resolved.fcdas, fcdaQuery]);

  if (!model) {
    return (
      <aside className="panel inspector-panel">
        <h2>Inspector</h2>
        <p className="hint">Load an SCD/XML file to inspect entities.</p>
      </aside>
    );
  }

  return (
    <aside className="panel inspector-panel">
      <div className="panel-title-row">
        <h2>Inspector</h2>
        <span className="entity-pill">{resolved.typeLabel}: {resolved.name}</span>
      </div>

      <div className="tabs-row wrap">
        <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
          Summary
        </button>
        <button className={tab === 'dataset' ? 'active' : ''} onClick={() => setTab('dataset')}>
          Dataset
        </button>
        <button className={tab === 'diff' ? 'active' : ''} onClick={() => setTab('diff')}>
          Diff
        </button>
        <button className={tab === 'xml' ? 'active' : ''} onClick={() => setTab('xml')}>
          XML
        </button>
        {selectedEntity.type === 'ied' ? (
          <button className={tab === 'unresolved' ? 'active' : ''} onClick={() => setTab('unresolved')}>
            Unresolved
          </button>
        ) : null}
      </div>

      {tab === 'summary' ? (
        <div className="summary-grid">
          {resolved.summary.map((item) => (
            <article key={item.label} className="info-card">
              <h4>{item.label}</h4>
              <p>{item.value}</p>
            </article>
          ))}
          {resolved.badges.length > 0 ? (
            <article className="info-card">
              <h4>Status</h4>
              <div className="badge-row">
                {resolved.badges.map((badge) => (
                  <span key={badge} className="badge neutral">{badge}</span>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {tab === 'dataset' ? (
        <div className="dataset-section">
          <div className="dataset-toolbar">
            <input
              className="input"
              placeholder="Search FCDA"
              value={fcdaQuery}
              onChange={(e) => setFcdaQuery(e.target.value)}
            />
            <Button
              onClick={() => void copyToClipboard(JSON.stringify(filteredFcdas, null, 2))}
              disabled={filteredFcdas.length === 0}
            >
              Copy FCDAs
            </Button>
          </div>
          <div className="fcda-table">
            <div className="fcda-head">
              <span>ldInst</span>
              <span>lnClass</span>
              <span>lnInst</span>
              <span>doName</span>
              <span>daName</span>
            </div>
            {filteredFcdas.map((fcda, idx) => {
              const das = lookupDas(fcda, model.dataTypeTemplates);
              return (
                <details className="fcda-expand" key={`${resolved.id}:fcda:${idx}`}>
                  <summary className="fcda-row">
                    <span>{fcda.ldInst || '-'}</span>
                    <span>{fcda.lnClass || '-'}</span>
                    <span>{fcda.lnInst || '-'}</span>
                    <span>{fcda.doName || '-'}</span>
                    <span>{fcda.daName || '-'}</span>
                  </summary>
                  {das.length > 0 ? (
                    <table className="fcda-da-table">
                      <thead><tr><th>DA name</th><th>FC</th></tr></thead>
                      <tbody>
                        {das.map((da) => (
                          <tr key={da.name}>
                            <td>{da.name}</td>
                            <td>{da.fc ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </details>
              );
            })}
            {filteredFcdas.length === 0 ? <p className="hint">No FCDA rows available.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'diff' ? (
        <div className="dataset-section">
          {!selectedChange ? <p className="hint">Select change in Compare mode to see before/after.</p> : null}
          {selectedChange ? (
            <>
              <p><strong>{selectedChange.summary}</strong></p>
              <ul className="simple-list">
                {selectedChange.details.map((detail) => (
                  <li key={`${selectedChange.id}:${detail.field}`}>{detail.field}: {detail.before || '-'} {'->'} {detail.after || '-'}</li>
                ))}
              </ul>
              <div className="fcda-table">
                <div className="fcda-head"><span>Field</span><span>Before</span><span>After</span><span></span><span></span></div>
                {selectedChange.details.map((detail) => (
                  <div className="fcda-row" key={`${selectedChange.id}:row:${detail.field}`}>
                    <span>{detail.field}</span>
                    <span>{detail.before || '-'}</span>
                    <span>{detail.after || '-'}</span>
                    <span></span>
                    <span></span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'xml' ? (
        <div className="xml-section">
          <Button
            onClick={() => void copyToClipboard(resolved.xmlSnippet || '')}
            disabled={!resolved.xmlSnippet}
          >
            Copy XML
          </Button>
          {!baselineModel ? <pre className="xml-snippet">{resolved.xmlSnippet || 'No XML snippet for this entity.'}</pre> : null}
          {baselineModel ? (
            <div className="xml-compare">
              <div>
                <p className="hint">Baseline A</p>
                <pre className="xml-snippet">{baselineModel.snippets[resolved.id] || 'No baseline snippet.'}</pre>
              </div>
              <div>
                <p className="hint">New B</p>
                <pre className="xml-snippet">{resolved.xmlSnippet || 'No new snippet.'}</pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'unresolved' && selectedEntity.type === 'ied' ? (
        <UnresolvedTab
          iedName={selectedEntity.id.replace('ied:', '')}
          edges={model?.edges ?? []}
          onExportCsv={() => {
            const iedName = selectedEntity.id.replace('ied:', '');
            const iedEdges = (model?.edges ?? []).filter(
              (e) => e.status === 'unresolved' && e.subscriberIed === iedName
            );
            const csv = [
              'Publisher IED,Control Block,Reason',
              ...iedEdges.map((e) => [e.publisherIed, e.controlBlockName ?? '', e.reason ?? ''].join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `unresolved-extrefs-${iedName}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
        />
      ) : null}
    </aside>
  );
}

function lookupDas(
  fcda: FcdaModel,
  dataTypeTemplates: DataTypeTemplatesModel | undefined,
): Array<{ name: string; fc?: string }> {
  if (!dataTypeTemplates || !fcda.lnClass || !fcda.doName) {
    return [];
  }
  let doTypeId: string | undefined;
  for (const lnt of dataTypeTemplates.lNodeTypes.values()) {
    if (lnt.lnClass === fcda.lnClass) {
      const doEntry = lnt.dos.find((d) => d.name === fcda.doName);
      if (doEntry) {
        doTypeId = doEntry.type;
        break;
      }
    }
  }
  if (!doTypeId) return [];
  const doType = dataTypeTemplates.doTypes.get(doTypeId);
  return doType?.das ?? [];
}

function resolveEntity(model: SclModel | undefined, baselineModel: SclModel | undefined, selected: SelectedEntity): {
  id: string;
  typeLabel: string;
  name: string;
  summary: Array<{ label: string; value: string }>;
  badges: string[];
  fcdas?: EdgeModel['fcdas'];
  xmlSnippet?: string;
} {
  if (!model || selected.type === 'none') {
    return {
      id: 'none',
      typeLabel: 'Entity',
      name: 'Select a node or edge',
      summary: [{ label: 'Hint', value: 'Use Cmd+K or click graph/tree/items.' }],
      badges: [],
    };
  }

  if (selected.type === 'edge') {
    const edge = model.edges.find((e) => e.key === selected.id);
    if (!edge) {
      return fallback();
    }
    const comm = resolveCommForEdge(model, edge);
    return {
      id: edge.key,
      typeLabel: 'Flow',
      name: `${edge.publisherIed} -> ${edge.subscriberIed}`,
      summary: [
        { label: 'Protocol', value: edge.signalType },
        { label: 'Control Block', value: edge.controlBlockName || '-' },
        { label: 'DataSet', value: edge.dataSetName || '-' },
        { label: 'SubNetwork', value: comm.subNetwork || '-' },
        { label: 'Publisher AP', value: comm.apName || '-' },
        { label: 'MAC', value: comm.mac || '-' },
        { label: 'APPID', value: comm.appId || '-' },
        { label: 'VLAN-ID', value: comm.vlanId || '-' },
        { label: 'Resolution', value: edge.status },
        { label: 'Reason', value: edge.reason || '-' },
      ],
      badges: [edge.status],
      fcdas: edge.fcdas,
    };
  }

  if (selected.type === 'ied') {
    const iedName = selected.id.replace('ied:', '');
    const ied = model.ieds.find((i) => i.name === iedName);
    if (ied) {
      const flow = summarizeIedFlows(model, iedName);
      const apNetwork = ied.accessPoints
        .map((ap) => `${ap.name} | IP:${ap.ip || '-'} | MAC:${ap.mac || '-'}`)
        .join(' ; ');
      return {
        id: selected.id,
        typeLabel: 'IED',
        name: ied.name,
        summary: [
          { label: 'AccessPoints', value: String(ied.accessPoints.length) },
          { label: 'LDevices', value: String(ied.lDevices.length) },
          { label: 'Bays', value: ied.bayNames.length > 0 ? ied.bayNames.join(', ') : 'Unassigned' },
          { label: 'Network', value: apNetwork || '-' },
          { label: 'GOOSE (out/in)', value: `${flow.GOOSE.outgoing} / ${flow.GOOSE.incoming}` },
          { label: 'SV (out/in)', value: `${flow.SV.outgoing} / ${flow.SV.incoming}` },
          { label: 'REPORT (out/in)', value: `${flow.REPORT.outgoing} / ${flow.REPORT.incoming}` },
          { label: 'Description', value: ied.desc || '-' },
        ],
        badges: [
          ...ied.accessPoints.map((ap) => `${ap.name}${ap.ip ? ` IP:${ap.ip}` : ''}${ap.mac ? ` MAC:${ap.mac}` : ''}`),
          `Flows:${flow.total}`,
        ],
        xmlSnippet: model.snippets[selected.id],
      };
    }

    const baselineIed = baselineModel?.ieds.find((i) => i.name === iedName);
    if (baselineIed) {
      return {
        id: selected.id,
        typeLabel: 'IED (Baseline)',
        name: baselineIed.name,
        summary: [
          { label: 'AccessPoints', value: String(baselineIed.accessPoints.length) },
          { label: 'LDevices', value: String(baselineIed.lDevices.length) },
          { label: 'Bays', value: baselineIed.bayNames.length > 0 ? baselineIed.bayNames.join(', ') : 'Unassigned' },
          { label: 'Description', value: baselineIed.desc || '-' },
        ],
        badges: ['REMOVED_IN_NEW'],
        xmlSnippet: baselineModel?.snippets[selected.id],
      };
    }

    return fallback();
  }

  const dataset = model.dataSets.find((d) => d.key === selected.id) || baselineModel?.dataSets.find((d) => d.key === selected.id);
  if (dataset) {
    return {
      id: dataset.key,
      typeLabel: 'DataSet',
      name: dataset.name,
      summary: [
        { label: 'IED', value: dataset.iedName },
        { label: 'LDevice', value: dataset.ldInst },
        { label: 'LN', value: `${dataset.lnClass}${dataset.lnInst ? `.${dataset.lnInst}` : ''}` },
        { label: 'FCDA count', value: String(dataset.fcdas.length) },
      ],
      badges: ['DATASET'],
      fcdas: dataset.fcdas,
      xmlSnippet: model.snippets[dataset.key] || baselineModel?.snippets[dataset.key],
    };
  }

  const activeControls = [...model.gseControls, ...model.svControls, ...model.reportControls];
  const baselineControls = [...(baselineModel?.gseControls || []), ...(baselineModel?.svControls || []), ...(baselineModel?.reportControls || [])];
  const control = activeControls.find((c) => c.key === selected.id) || baselineControls.find((c) => c.key === selected.id);
  if (control) {
    const sourceModel = activeControls.some((c) => c.key === control.key) ? model : baselineModel || model;
    const comm = resolveCommForControl(sourceModel, control);
    const fcdas = control.datSet
      ? model.dataSets.find((d) => d.name === control.datSet && d.iedName === control.iedName)?.fcdas
      : [];
    return {
      id: control.key,
      typeLabel: 'ControlBlock',
      name: control.name,
      summary: [
        { label: 'Type', value: control.type },
        { label: 'IED', value: control.iedName },
        { label: 'DataSet', value: control.datSet || '-' },
        { label: 'LN', value: `${control.lnClass}${control.lnInst ? `.${control.lnInst}` : ''}` },
        { label: 'SubNetwork', value: comm.subNetwork || '-' },
        { label: 'Publisher AP', value: comm.apName || control.apName || '-' },
        { label: 'MAC', value: comm.mac || '-' },
        { label: 'APPID', value: comm.appId || '-' },
        { label: 'VLAN-ID', value: comm.vlanId || '-' },
        { label: 'ConfRev', value: control.confRev || '-' },
      ],
      badges: [control.type],
      fcdas,
      xmlSnippet: model.snippets[control.key] || baselineModel?.snippets[control.key],
    };
  }

  return fallback();
}

function fallback() {
  return {
    id: 'unknown',
    typeLabel: 'Entity',
    name: 'Not found',
    summary: [{ label: 'Status', value: 'Entity was not found in current model.' }],
    badges: [],
  };
}

function summarizeIedFlows(model: SclModel, iedName: string): {
  total: number;
  GOOSE: { incoming: number; outgoing: number };
  SV: { incoming: number; outgoing: number };
  REPORT: { incoming: number; outgoing: number };
} {
  const summary = {
    total: 0,
    GOOSE: { incoming: 0, outgoing: 0 },
    SV: { incoming: 0, outgoing: 0 },
    REPORT: { incoming: 0, outgoing: 0 },
  };
  for (const edge of model.edges) {
    if (edge.publisherIed !== iedName && edge.subscriberIed !== iedName) {
      continue;
    }
    summary.total += 1;
    const bucket = summary[edge.signalType];
    if (edge.publisherIed === iedName) {
      bucket.outgoing += 1;
    }
    if (edge.subscriberIed === iedName) {
      bucket.incoming += 1;
    }
  }
  return summary;
}

function resolveCommForEdge(model: SclModel, edge: EdgeModel): {
  apName?: string;
  subNetwork?: string;
  ip?: string;
  mac?: string;
  appId?: string;
  vlanId?: string;
} {
  if (edge.signalType === 'GOOSE') {
    const comm =
      model.gseComms.find(
        (item) =>
          item.iedName === edge.publisherIed &&
          (!edge.controlBlockName || item.cbName === edge.controlBlockName),
      ) || model.gseComms.find((item) => item.iedName === edge.publisherIed);
    return withConnectedAp(model, edge.publisherIed, comm?.apName, {
      apName: comm?.apName,
      mac: comm?.mac,
      appId: comm?.appId,
      vlanId: comm?.vlanId,
    });
  }
  if (edge.signalType === 'SV') {
    const comm =
      model.smvComms.find(
        (item) =>
          item.iedName === edge.publisherIed &&
          (!edge.controlBlockName || item.cbName === edge.controlBlockName),
      ) || model.smvComms.find((item) => item.iedName === edge.publisherIed);
    return withConnectedAp(model, edge.publisherIed, comm?.apName, {
      apName: comm?.apName,
      mac: comm?.mac,
      appId: comm?.appId,
      vlanId: comm?.vlanId,
    });
  }
  return withConnectedAp(model, edge.publisherIed, undefined, {});
}

function resolveCommForControl(
  model: SclModel,
  control: {
    type: 'GOOSE' | 'SV' | 'REPORT';
    iedName: string;
    apName?: string;
    name: string;
  },
): {
  apName?: string;
  subNetwork?: string;
  ip?: string;
  mac?: string;
  appId?: string;
  vlanId?: string;
} {
  if (control.type === 'GOOSE') {
    const comm =
      model.gseComms.find(
        (item) =>
          item.iedName === control.iedName &&
          item.apName === control.apName &&
          item.cbName === control.name,
      ) ||
      model.gseComms.find(
        (item) =>
          item.iedName === control.iedName &&
          (!control.apName || item.apName === control.apName),
      );
    return withConnectedAp(model, control.iedName, comm?.apName || control.apName, {
      apName: comm?.apName || control.apName,
      mac: comm?.mac,
      appId: comm?.appId,
      vlanId: comm?.vlanId,
    });
  }
  if (control.type === 'SV') {
    const comm =
      model.smvComms.find(
        (item) =>
          item.iedName === control.iedName &&
          item.apName === control.apName &&
          item.cbName === control.name,
      ) ||
      model.smvComms.find(
        (item) =>
          item.iedName === control.iedName &&
          (!control.apName || item.apName === control.apName),
      );
    return withConnectedAp(model, control.iedName, comm?.apName || control.apName, {
      apName: comm?.apName || control.apName,
      mac: comm?.mac,
      appId: comm?.appId,
      vlanId: comm?.vlanId,
    });
  }
  return withConnectedAp(model, control.iedName, control.apName, {
    apName: control.apName,
  });
}

function withConnectedAp(
  model: SclModel,
  iedName: string,
  apName: string | undefined,
  base: {
    apName?: string;
    mac?: string;
    appId?: string;
    vlanId?: string;
  },
): {
  apName?: string;
  subNetwork?: string;
  ip?: string;
  mac?: string;
  appId?: string;
  vlanId?: string;
} {
  const ied = model.ieds.find((item) => item.name === iedName);
  const ap =
    (apName ? ied?.accessPoints.find((item) => item.name === apName) : undefined) ||
    ied?.accessPoints[0];
  let subNetwork: string | undefined;
  for (const subnet of model.subNetworks) {
    const hit = subnet.connectedAps.find(
      (cap) => cap.iedName === iedName && (!apName || cap.apName === apName),
    );
    if (hit) {
      subNetwork = subnet.name;
      break;
    }
  }
  return {
    apName: base.apName || ap?.name,
    subNetwork,
    ip: ap?.ip,
    mac: base.mac || ap?.mac,
    appId: base.appId,
    vlanId: base.vlanId,
  };
}

function UnresolvedTab({
  iedName,
  edges,
  onExportCsv,
}: {
  iedName: string;
  edges: EdgeModel[];
  onExportCsv: () => void;
}): JSX.Element {
  const unresolvedEdges = useMemo(
    () => edges.filter((e) => e.status === 'unresolved' && e.subscriberIed === iedName),
    [edges, iedName],
  );

  if (unresolvedEdges.length === 0) {
    return (
      <div style={{ padding: '16px 8px' }}>
        <p className="hint">No unresolved ExtRefs for this IED.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <span className="hint">{unresolvedEdges.length} unresolved ExtRef(s)</span>
        <Button onClick={onExportCsv}>Export CSV</Button>
      </div>
      <div style={{ overflowY: 'auto', flex: '1 1 0' }}>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Publisher IED</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Control Block</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {unresolvedEdges.map((edge) => (
              <tr key={edge.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '4px 8px' }}>{edge.publisherIed}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '10px' }}>
                  {edge.controlBlockName ?? '—'}
                </td>
                <td style={{ padding: '4px 8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {edge.reason ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
