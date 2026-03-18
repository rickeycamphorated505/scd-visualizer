import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { SclModel } from '../model/types';
import { computeScdStatistics } from '../utils/scdStatistics';

interface StatisticsWorkspaceProps {
  model: SclModel | undefined;
}

function StatCard({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="stat-card">
      <span className="stat-card-value">{value}</span>
      <span className="stat-card-label">{label}</span>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="stats-section">
      <button
        type="button"
        className="stats-section-title"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {title}
        <span className="stats-section-toggle">{open ? '▼' : '▶'}</span>
      </button>
      {open ? <div className="stats-section-body">{children}</div> : null}
    </section>
  );
}

function DictTable({ data }: { data: Record<string, number> }): JSX.Element {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="hint">No data.</p>;
  }
  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td className="stats-table-num">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListBlock({ items, title, id }: { items: string[]; title: string; id: string }): JSX.Element {
  return (
    <div className="stats-list-block">
      <h4 id={id}>{title} ({items.length})</h4>
      <ul className="stats-list" aria-labelledby={id}>
        {items.slice(0, 200).map((item) => (
          <li key={item}>{item}</li>
        ))}
        {items.length > 200 ? <li className="hint">… and {items.length - 200} more</li> : null}
      </ul>
    </div>
  );
}

export default function StatisticsWorkspace({ model }: StatisticsWorkspaceProps): JSX.Element {
  const stats = useMemo(() => computeScdStatistics(model), [model]);

  if (!model) {
    return (
      <section className="panel" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <p className="hint">Load an SCD file to see statistics.</p>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="panel" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <p className="hint">Unable to compute statistics.</p>
      </section>
    );
  }

  const { summary, system, network, goose, smv, datasets, signals, lists } = stats;

  return (
    <section className="panel stats-workspace">
      <div className="stats-workspace-inner">
        <h2 className="stats-page-title">SCD Statistics</h2>
        <p className="hint stats-page-desc">Engineering summary and overview of system scope and communication structure.</p>

        <Section title="Summary" defaultOpen={true}>
          <div className="stat-cards">
            <StatCard label="IEDs" value={summary.ieds} />
            <StatCard label="Logical Nodes" value={summary.logicalNodes} />
            <StatCard label="GOOSE" value={summary.goose} />
            <StatCard label="SMV" value={summary.smv} />
            <StatCard label="Datasets" value={summary.datasets} />
            <StatCard label="IPs" value={summary.ips} />
            <StatCard label="MACs" value={summary.macs} />
            <StatCard label="VLANs" value={summary.vlans} />
            <StatCard label="APPIDs" value={summary.appIds} />
          </div>
        </Section>

        <Section title="System">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Substations" value={system.substations} />
            <StatCard label="Voltage Levels" value={system.voltageLevels} />
            <StatCard label="Bays" value={system.bays} />
            <StatCard label="IEDs" value={system.ieds} />
            <StatCard label="Access Points" value={system.accessPoints} />
            <StatCard label="LDevices" value={system.lDevices} />
            <StatCard label="Logical Nodes" value={system.logicalNodes} />
          </div>
        </Section>

        <Section title="Network">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Communication networks" value={network.communicationNetworks} />
            <StatCard label="ConnectedAPs" value={network.connectedAps} />
            <StatCard label="Unique IPs" value={network.uniqueIps} />
            <StatCard label="Unique MACs" value={network.uniqueMacs} />
            <StatCard label="Unique VLAN IDs" value={network.uniqueVlanIds} />
            <StatCard label="Unique APPIDs" value={network.uniqueAppIds} />
            <StatCard label="APs with network info" value={network.apsWithNetworkInfo} />
            <StatCard label="APs without network info" value={network.apsWithoutNetworkInfo} />
          </div>
        </Section>

        <Section title="GOOSE">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Control blocks" value={goose.controlBlocks} />
            <StatCard label="Publishers" value={goose.publishers} />
            <StatCard label="Subscribers" value={goose.subscribers} />
            <StatCard label="Messages/signals" value={goose.messages} />
            <StatCard label="Max per IED" value={goose.maxPerIed} />
          </div>
          {goose.maxPerIed > 0 && goose.maxPerIedIedNames.length > 0 ? (
            <p className="hint stats-max-ied">
              <strong>Max GOOSE per IED:</strong> {goose.maxPerIed} — {goose.maxPerIedIedNames.join(', ')}
            </p>
          ) : null}
          <div className="stats-dict-grid">
            <div><h4>By IED</h4><DictTable data={goose.byIed} /></div>
            <div><h4>By VLAN</h4><DictTable data={goose.byVlan} /></div>
            <div><h4>By APPID</h4><DictTable data={goose.byAppId} /></div>
          </div>
        </Section>

        <Section title="SMV">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Control blocks" value={smv.controlBlocks} />
            <StatCard label="Publishers" value={smv.publishers} />
            <StatCard label="Subscribers" value={smv.subscribers} />
            <StatCard label="Max per IED" value={smv.maxPerIed} />
          </div>
          {smv.maxPerIed > 0 && smv.maxPerIedIedNames.length > 0 ? (
            <p className="hint stats-max-ied">
              <strong>Max SMV per IED:</strong> {smv.maxPerIed} — {smv.maxPerIedIedNames.join(', ')}
            </p>
          ) : null}
          <div className="stats-dict-grid">
            <div><h4>By IED</h4><DictTable data={smv.byIed} /></div>
            <div><h4>By VLAN</h4><DictTable data={smv.byVlan} /></div>
            <div><h4>By APPID</h4><DictTable data={smv.byAppId} /></div>
          </div>
        </Section>

        <Section title="Datasets">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Total datasets" value={datasets.totalDatasets} />
            <StatCard label="Total entries" value={datasets.totalEntries} />
            <StatCard label="Min entries (dataset)" value={datasets.minCount} />
            <StatCard label="Max entries (dataset)" value={datasets.maxCount} />
            <StatCard label="Avg per dataset" value={datasets.avgPerDataset} />
          </div>
          <h4>Datasets per IED</h4>
          <DictTable data={datasets.perIed} />
        </Section>

        <Section title="Signals">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Total signals/refs" value={signals.totalSignalsOrRefs} />
            <StatCard label="GOOSE signals" value={signals.gooseSignals} />
            <StatCard label="SMV signals" value={signals.smvSignals} />
          </div>
        </Section>

        <Section title="Lists">
          <div className="stats-lists-grid">
            <ListBlock id="list-ips" title="IP addresses" items={lists.ips} />
            <ListBlock id="list-macs" title="MAC addresses" items={lists.macs} />
            <ListBlock id="list-vlans" title="VLAN IDs" items={lists.vlanIds} />
            <ListBlock id="list-appids" title="APPIDs" items={lists.appIds} />
            <ListBlock id="list-datasets" title="Dataset names" items={lists.datasetNames} />
            <ListBlock id="list-ieds" title="IED names" items={lists.iedNames} />
          </div>
        </Section>
      </div>
    </section>
  );
}
