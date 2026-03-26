import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { HitemModel, SclModel } from '../model/types';
import { computeScdStatistics, type IedTrafficRow } from '../utils/scdStatistics';

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

interface HBarProps {
  rows: Array<{ label: string; value: number }>;
  color: string;
  unit?: string;
  maxRows?: number;
  animateOnMount?: boolean;
}

function formatHBarValue(value: number, unit?: string): string {
  if (!unit) return value.toFixed(0);
  if (unit === 'MB/s') return `${value.toFixed(2)} MB/s`;
  return `${Math.round(value)} ${unit}`;
}

function HorizontalBarChart({
  rows,
  color,
  unit,
  maxRows = 25,
  animateOnMount = true,
}: HBarProps): JSX.Element {
  const visibleRows = rows
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, maxRows);

  const maxValue = visibleRows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  const rowH = 26;

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!animateOnMount) return;
    const id = requestAnimationFrame(() => {
      window.setTimeout(() => setAnimate(true), 50);
    });
    return () => cancelAnimationFrame(id);
  }, [animateOnMount]);

  const uid = useId();
  const clipId = `hbar-clip-${uid.replace(/:/g, '')}`;
  const LABEL_W = 190;
  const TOTAL_W = 560;
  const VALUE_W = 120;
  const BAR_W = TOTAL_W - LABEL_W - VALUE_W;

  return (
    <svg
      className={`hbar-svg ${animate ? 'hbar-animate' : ''}`}
      viewBox={`0 0 ${TOTAL_W} ${Math.max(1, visibleRows.length) * rowH}`}
      width="100%"
      preserveAspectRatio="none"
      aria-label="Horizontal bar chart"
    >
      <defs>
        {visibleRows.map((r, i) => {
          const y = i * rowH;
          return (
            <clipPath key={r.label} id={`${clipId}-${i}`}>
              <rect x={0} y={y} width={LABEL_W} height={rowH} />
            </clipPath>
          );
        })}
      </defs>

      {visibleRows.length === 0 ? (
        <text x={LABEL_W} y={rowH / 2} fontSize="12" fill="var(--muted)" textAnchor="start">
          No data
        </text>
      ) : null}

      {visibleRows.map((r, i) => {
        const y = i * rowH;
        const w = r.value > 0 ? Math.max(2, (r.value / maxValue) * BAR_W) : 0;
        const valueText = formatHBarValue(r.value, unit);

        return (
          <g key={`${r.label}:${r.value}`} transform={`translate(0, ${y})`}>
            <text
              x={8}
              y={18}
              fontSize={12}
              fill="var(--text-secondary)"
              clipPath={`url(#${clipId}-${i})`}
            >
              <title>{r.label}</title>
              {r.label}
            </text>

            <rect
              className="hbar-bar"
              x={LABEL_W}
              y={7}
              width={w}
              height={12}
              rx={4}
              fill={color}
              style={{
                transitionDelay: `${i * 10}ms`,
              }}
            />

            <text x={LABEL_W + BAR_W + 8} y={18} fontSize={11} fill="var(--muted)">
              {valueText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DatasetSizeHistogram({ dataSets }: { dataSets: Array<{ fcdas: unknown[] }> }): JSX.Element {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.setTimeout(() => setAnimate(true), 50);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const buckets = useMemo(
    () => [
      { key: '1', label: '1', span: 1, test: (n: number) => n === 1 },
      { key: '2-5', label: '2–5', span: 4, test: (n: number) => n >= 2 && n <= 5 },
      { key: '6-10', label: '6–10', span: 5, test: (n: number) => n >= 6 && n <= 10 },
      { key: '11-20', label: '11–20', span: 10, test: (n: number) => n >= 11 && n <= 20 },
      { key: '21-50', label: '21–50', span: 30, test: (n: number) => n >= 21 && n <= 50 },
      { key: '51+', label: '51+', span: 15, test: (n: number) => n >= 51 },
    ],
    [],
  );

  const counts = useMemo(() => {
    const sizes = dataSets.map((ds) => ds.fcdas.length);
    return buckets.map((b) => sizes.reduce((s, n) => s + (b.test(n) ? 1 : 0), 0));
  }, [buckets, dataSets]);

  const maxCount = Math.max(...counts, 0);
  const W = 640;
  const H = 170;
  const baseY = 125;
  const maxH = 80;
  const padding = 10;
  const gap = 10;
  const totalSpan = buckets.reduce((s, b) => s + b.span, 0) || 1;
  const colAreaW = W - padding * 2 - gap * (buckets.length - 1);

  let x = padding;
  return (
    <div>
      <svg className={`stats-histogram ${animate ? 'stats-histogram-animate' : ''}`} viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none">
        {counts.map((c, i) => {
          const b = buckets[i];
          const colW = (colAreaW * b.span) / totalSpan;
          const h = maxCount > 0 ? (c / maxCount) * maxH : 0;
          const y = baseY - h;

          const rectX = x;
          x += colW + gap;

          return (
            <g key={b.key}>
              <rect
                className="stats-histogram-col"
                x={rectX}
                y={y}
                width={Math.max(2, colW)}
                height={h}
                rx={6}
                fill="var(--mms)"
                style={{ transitionDelay: `${i * 70}ms` }}
              />
              <text x={rectX + colW / 2} y={Math.max(12, y - 6)} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">
                {c}
              </text>
              <text x={rectX + colW / 2} y={H - 16} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
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
  const [showAllRevisions, setShowAllRevisions] = useState(false);

  useEffect(() => {
    setShowAllRevisions(false);
  }, [model]);

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

  const { summary, system, network, goose, smv, datasets, signals, iedTraffic, revisionHistory, lists } = stats;

  const revisionLatestFirst = useMemo(() => {
    return [...revisionHistory].reverse();
  }, [revisionHistory]);

  const revisionVisible = showAllRevisions ? revisionLatestFirst : revisionLatestFirst.slice(0, 20);

  const iedTrafficBandwidthRows = useMemo(
    () =>
      iedTraffic.map((r: IedTrafficRow) => ({
        label: r.iedName,
        value: r.estMbps,
      })),
    [iedTraffic],
  );
  const iedTrafficPublishedRows = useMemo(
    () =>
      iedTraffic.map((r: IedTrafficRow) => ({
        label: r.iedName,
        value: r.gooseOut + r.svOut + r.reportOut,
      })),
    [iedTraffic],
  );
  const iedTrafficIncomingRows = useMemo(
    () =>
      iedTraffic.map((r: IedTrafficRow) => ({
        label: r.iedName,
        value: r.gooseIn + r.svIn,
      })),
    [iedTraffic],
  );

  const datasetSizeData = useMemo(() => model.dataSets.map((ds) => ({ fcdas: ds.fcdas })), [model]);

  const gooseByIedRows = useMemo(
    () =>
      Object.entries(goose.byIed)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
    [goose.byIed],
  );
  const smvByIedRows = useMemo(
    () =>
      Object.entries(smv.byIed)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
    [smv.byIed],
  );
  const datasetsPerIedRows = useMemo(
    () =>
      Object.entries(datasets.perIed)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
    [datasets.perIed],
  );

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

        <Section title="IED Traffic (Estimated)">
          <h4>Estimated bandwidth per IED</h4>
          <HorizontalBarChart rows={iedTrafficBandwidthRows} color="var(--sv)" unit="MB/s" maxRows={25} />
          <p className="hint">GOOSE = 250B×10fps &nbsp;|&nbsp; SV = 220B×4000fps per control block</p>

          <h4>Published control blocks per IED</h4>
          <HorizontalBarChart rows={iedTrafficPublishedRows} color="var(--goose)" unit="ctrl" maxRows={25} />

          <h4>Incoming subscriptions per IED</h4>
          <HorizontalBarChart rows={iedTrafficIncomingRows} color="var(--mms)" unit="subs" maxRows={25} />
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
            <div>
              <h4>By IED</h4>
              <HorizontalBarChart rows={gooseByIedRows} color="var(--goose)" unit="ctrl" />
            </div>
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
            <div>
              <h4>By IED</h4>
              <HorizontalBarChart rows={smvByIedRows} color="var(--sv)" unit="ctrl" />
            </div>
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
          <h4>Dataset size distribution</h4>
          <div className="stats-histogram-wrap">
            <DatasetSizeHistogram dataSets={datasetSizeData} />
          </div>
          <h4>Datasets per IED</h4>
          <HorizontalBarChart rows={datasetsPerIedRows} color="var(--mms)" unit="ds" />
        </Section>

        <Section title="Signals">
          <div className="stat-cards stat-cards-compact">
            <StatCard label="Total signals/refs" value={signals.totalSignalsOrRefs} />
            <StatCard label="GOOSE signals" value={signals.gooseSignals} />
            <StatCard label="SMV signals" value={signals.smvSignals} />
            <StatCard label="Data objects (types)" value={signals.dataObjects} />
            <StatCard label="Data attributes (types)" value={signals.dataAttributes} />
          </div>
        </Section>

        <Section title="SCD Revision History" defaultOpen={false}>
          {revisionHistory.length === 0 ? (
            <p className="hint">No revision history in this file.</p>
          ) : (
            <>
              {revisionHistory.length > 20 ? (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <button className="btn" type="button" onClick={() => setShowAllRevisions((v) => !v)}>
                    {showAllRevisions ? `Show latest 20 revisions` : `Show all ${revisionHistory.length} revisions`}
                  </button>
                </div>
              ) : null}
              <div className="stats-timeline">
                {revisionVisible.map((h: HitemModel, idx: number) => {
                  const isLatest = idx === 0;
                  return (
                    <div key={`${h.version ?? 'v'}:${h.revision ?? 'r'}:${idx}`} className="stats-timeline-row">
                      <span className={`stats-timeline-dot ${isLatest ? 'stats-timeline-dot-latest' : ''}`} />
                      <span className={`stats-timeline-badge ${isLatest ? 'stats-timeline-badge-latest' : ''}`}>
                        v{h.version ?? '-'} R{h.revision ?? '-'}
                      </span>
                      <span className="stats-timeline-what">{h.what ?? '-'}</span>
                      <span className="stats-timeline-when">
                        {h.when ?? '-'} — {h.who ?? '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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
