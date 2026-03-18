import type { EdgeModel, SclModel } from '../model/types';

interface DetailsPanelProps {
  model?: SclModel;
  selectedKey?: string;
  selectedEdge?: EdgeModel;
}

export default function DetailsPanel({ model, selectedKey, selectedEdge }: DetailsPanelProps): JSX.Element {
  if (!model) {
    return (
      <aside className="details-panel">
        <h2>Details</h2>
        <p>No file loaded.</p>
      </aside>
    );
  }

  if (selectedEdge) {
    return (
      <aside className="details-panel">
        <h2>Edge Details</h2>
        <dl>
          <dt>Signal type</dt>
          <dd>{selectedEdge.signalType}</dd>
          <dt>Publisher</dt>
          <dd>{selectedEdge.publisherIed}</dd>
          <dt>Subscriber</dt>
          <dd>{selectedEdge.subscriberIed}</dd>
          <dt>Control block</dt>
          <dd>{selectedEdge.controlBlockName || '-'}</dd>
          <dt>DataSet</dt>
          <dd>{selectedEdge.dataSetName || '-'}</dd>
          <dt>Status</dt>
          <dd>{selectedEdge.status}</dd>
          <dt>Reason</dt>
          <dd>{selectedEdge.reason || '-'}</dd>
        </dl>
        <h3>FCDAs</h3>
        {selectedEdge.fcdas.length === 0 ? <p>No FCDA data.</p> : null}
        {selectedEdge.fcdas.map((fcda, idx) => (
          <pre key={`${selectedEdge.key}:fcda:${idx}`} className="xml-snippet">
            {JSON.stringify(fcda, null, 2)}
          </pre>
        ))}
      </aside>
    );
  }

  const parsed = resolveParsedDetails(model, selectedKey);
  const snippet = selectedKey ? model.snippets[selectedKey] : undefined;
  const selectedIed =
    selectedKey && /^ied:[^:]+$/.test(selectedKey) ? selectedKey.replace('ied:', '') : undefined;
  const outgoing = selectedIed
    ? model.edges.filter((edge) => edge.publisherIed === selectedIed)
    : [];

  return (
    <aside className="details-panel">
      <h2>Details</h2>
      {selectedKey ? <p className="muted">{selectedKey}</p> : <p>Select node or edge.</p>}
      {parsed ? (
        <pre className="xml-snippet">{JSON.stringify(parsed, null, 2)}</pre>
      ) : (
        <p>No parsed properties available.</p>
      )}
      {selectedIed ? (
        <>
          <h3>Outgoing Flows ({selectedIed})</h3>
          {outgoing.length === 0 ? <p>No outgoing GOOSE/SV/Report edges found.</p> : null}
          {outgoing.map((edge) => (
            <p key={edge.key}>
              {edge.signalType} {'->'} {edge.subscriberIed} ({edge.controlBlockName || 'unknown CB'}) [{edge.status}]
            </p>
          ))}
        </>
      ) : null}
      <h3>Raw XML Snippet</h3>
      {snippet ? <pre className="xml-snippet">{snippet}</pre> : <p>No snippet available.</p>}
    </aside>
  );
}

function resolveParsedDetails(model: SclModel, selectedKey?: string): unknown {
  if (!selectedKey) {
    return undefined;
  }

  const ied = model.ieds.find((i) => `ied:${i.name}` === selectedKey);
  if (ied) {
    return ied;
  }

  const dataset = model.dataSets.find((d) => d.key === selectedKey);
  if (dataset) {
    return dataset;
  }

  const gse = model.gseControls.find((g) => g.key === selectedKey);
  if (gse) {
    return gse;
  }

  const sv = model.svControls.find((s) => s.key === selectedKey);
  if (sv) {
    return sv;
  }

  const rpt = model.reportControls.find((r) => r.key === selectedKey);
  if (rpt) {
    return rpt;
  }

  const subnet = model.subNetworks.find((sn) => `subnetwork:${sn.name}` === selectedKey);
  if (subnet) {
    return subnet;
  }

  if (selectedKey.startsWith('connectedap:')) {
    for (const sn of model.subNetworks) {
      const cap = sn.connectedAps.find((c) => `connectedap:${sn.name}:${c.iedName}:${c.apName}` === selectedKey);
      if (cap) {
        return cap;
      }
    }
  }

  if (selectedKey.startsWith('ied:') && selectedKey.includes(':ap:')) {
    const parts = selectedKey.split(':');
    if (parts.length >= 4) {
      const iedName = parts[1];
      const apName = parts[3];
      const currentIed = model.ieds.find((i) => i.name === iedName);
      return currentIed?.accessPoints.find((a) => a.name === apName);
    }
  }

  return undefined;
}
