import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Edge,
  type Node,
  type OnMove,
  type ReactFlowInstance,
  type XYPosition,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { SclModel } from '../model/types';
import {
  buildNetworkPortFilterRows,
  buildNetworkPortSummaryRows,
  buildNetworkTopologyView,
  DEFAULT_NETWORK_FILTERS,
  discoverSubNetworks,
} from '../network/buildNetworkView';
import { networkPortFiltersCsv, networkPortSummaryCsv } from '../network/export';
import { printNetworkSummary } from '../utils/exportNetworkPdf';
import {
  buildPortTableRows,
  defaultTableQuickFilters,
  filterProtocolItems,
  unresolvedItems,
  type RowHealth,
  type TableQuickFilters,
} from '../network/networkUi';
import type {
  NetworkTopologyView,
  NetworkTrafficFilters,
  PortFlowItem,
  TrafficProtocol,
} from '../network/types';
import NetworkPortTable from './network/NetworkPortTable';
import VirtualList from './network/VirtualList';
import ThreePaneLayout from './ThreePaneLayout';
import { Button, Chip } from './ui';

interface NetworkVisualizerPanelProps {
  model?: SclModel;
  fileName: string;
  onExportBlob: (content: string, file: string, mime?: string) => void;
}

const EMPTY_NODE_TYPES = {};
const EMPTY_EDGE_TYPES = {};
const DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' as const, animated: false };
const FIT_VIEW_OPTIONS = { duration: 220, padding: 0.2, includeHiddenNodes: true };

type DetailsTab = 'summary' | 'GOOSE' | 'SV' | 'REPORT' | 'issues';
const DETAIL_ROW_HEIGHT = 42;

export default function NetworkVisualizerPanel({
  model,
  fileName,
  onExportBlob,
}: NetworkVisualizerPanelProps): JSX.Element {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const missingSizeWarned = useRef(false);
  const [selectedSubNetwork, setSelectedSubNetwork] = useState('');
  const [filters, setFilters] = useState<NetworkTrafficFilters>(DEFAULT_NETWORK_FILTERS);
  const [quickFilters, setQuickFilters] = useState<TableQuickFilters>(defaultTableQuickFilters());
  const [selectedPortKey, setSelectedPortKey] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('summary');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showDebugRawList, setShowDebugRawList] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const subNetworks = useMemo(() => discoverSubNetworks(model), [model]);

  useEffect(() => {
    if (subNetworks.length === 0) {
      setSelectedSubNetwork('');
      return;
    }
    if (subNetworks.length === 1) {
      setSelectedSubNetwork(subNetworks[0]);
      return;
    }
    if (!selectedSubNetwork || !subNetworks.includes(selectedSubNetwork)) {
      setSelectedSubNetwork(subNetworks[0]);
    }
  }, [subNetworks, selectedSubNetwork]);

  const fullView = useMemo(() => {
    if (!model || !selectedSubNetwork) {
      return null;
    }
    return buildNetworkTopologyView(model, selectedSubNetwork, DEFAULT_NETWORK_FILTERS);
  }, [model, selectedSubNetwork]);

  const view = useMemo(() => {
    if (!model || !selectedSubNetwork) {
      return null;
    }
    return buildNetworkTopologyView(model, selectedSubNetwork, filters);
  }, [model, selectedSubNetwork, filters]);

  const tableRows = useMemo(() => {
    if (!model || !view) {
      return [];
    }
    return buildPortTableRows(model, view.ports, quickFilters);
  }, [model, view, quickFilters]);

  useEffect(() => {
    if (tableRows.length === 0) {
      setSelectedPortKey(null);
      return;
    }
    if (selectedPortKey && tableRows.some((row) => row.key === selectedPortKey)) {
      return;
    }
    setSelectedPortKey(tableRows[0].key);
  }, [tableRows, selectedPortKey]);

  const selectedPort = useMemo(
    () => (selectedPortKey && view ? view.ports.find((port) => port.key === selectedPortKey) || null : null),
    [selectedPortKey, view],
  );

  const selectedIedInfo = useMemo(
    () => (selectedPort && model ? model.ieds.find((ied) => ied.name === selectedPort.iedName) : undefined),
    [selectedPort, model],
  );

  const detailsItems = useMemo(() => selectedPort?.filteredFlowItems || [], [selectedPort]);

  const groupItems = useMemo(() => {
    const grouped = new Map<string, PortFlowItem[]>();
    for (const item of detailsItems) {
      const key = item.controlBlockName || 'unknown-control-block';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
    return Array.from(grouped.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [detailsItems]);

  const topPublishers = useMemo(() => topTalkers(detailsItems, 'sourceIed'), [detailsItems]);
  const topSubscribers = useMemo(() => topTalkers(detailsItems, 'destinationIed'), [detailsItems]);
  const vlanDist = useMemo(() => distribution(detailsItems, 'vlanId'), [detailsItems]);
  const prioDist = useMemo(() => distribution(detailsItems, 'vlanPriority'), [detailsItems]);
  const appidDist = useMemo(() => distribution(detailsItems, 'appId'), [detailsItems]);
  const trafficEstimate = useMemo(() => estimateTraffic(detailsItems), [detailsItems]);

  const totalRenderedEdges = useMemo(
    () => (view ? view.links.reduce((sum, link) => sum + link.filteredFlowItems.length, 0) : 0),
    [view],
  );
  const totalEdges = useMemo(
    () => (view ? view.links.reduce((sum, link) => sum + link.flowItems.length, 0) : 0),
    [view],
  );
  const totalUnresolved = useMemo(
    () =>
      view
        ? view.links.reduce(
            (sum, link) => sum + link.flowItems.filter((item) => item.status !== 'resolved').length,
            0,
          )
        : 0,
    [view],
  );

  const { nodes, edges } = useMemo(() => {
    if (!view) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }
    const trafficByIed = showHeat ? computeTrafficByIed(view) : new Map<string, number>();
    return buildGraph(view, trafficByIed, showHeat);
  }, [view, showHeat]);

  const hasRenderableContainer = containerSize.width > 40 && containerSize.height > 40;

  useEffect(() => {
    const el = graphRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
      if ((rect.width <= 40 || rect.height <= 40) && !missingSizeWarned.current) {
        missingSizeWarned.current = true;
        console.warn('[NetworkVisualizerPanel] graph container size too small', {
          width: rect.width,
          height: rect.height,
        });
      }
      if (rect.width > 40 && rect.height > 40) {
        missingSizeWarned.current = false;
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!flow || !hasRenderableContainer || nodes.length === 0) {
      return;
    }
    const tryFit = (attempt = 0) => {
      const readyNodes = flow.getNodes().length;
      if (readyNodes === 0 && attempt < 8) {
        window.requestAnimationFrame(() => tryFit(attempt + 1));
        return;
      }
      void flow.fitView({ ...FIT_VIEW_OPTIONS, minZoom: 0.05 });
      const viewport = flow.getViewport();
      if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0.001) {
        flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
      }
    };
    window.requestAnimationFrame(() => tryFit());
  }, [flow, hasRenderableContainer, nodes.length, edges.length, selectedSubNetwork]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!view) {
      return;
    }
    if (node.id.startsWith('ied:')) {
      const iedName = node.id.slice(4);
      const firstPort = view.ports.find((port) => port.iedName === iedName);
      if (firstPort) {
        setSelectedPortKey(firstPort.key);
      }
      return;
    }
  }, [view]);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (!view) {
      return;
    }
    const data = edge.data as { kind?: string; linkId?: string } | undefined;
    if (data?.kind !== 'traffic' || !data.linkId) {
      return;
    }
    const link = view.links.find((item) => item.id === data.linkId);
    if (!link) {
      return;
    }
    setSelectedPortKey(link.portKey);
    setDetailsTab('summary');
  }, [view]);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    setFlow(instance);
  }, []);

  const handleMove = useCallback<OnMove>((_event, viewport) => {
    setZoom(viewport.zoom);
  }, []);

  const handleFitView = useCallback(() => {
    if (!flow) {
      return;
    }
    if (!hasRenderableContainer) {
      flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
      return;
    }
    void flow.fitView({ ...FIT_VIEW_OPTIONS, minZoom: 0.05 });
  }, [flow, hasRenderableContainer]);

  const handleDiagnostics = useCallback(() => {
    const payload = {
      timestamp: new Date().toISOString(),
      subNetwork: selectedSubNetwork,
      visibleNodes: nodes.length,
      visibleEdges: edges.length,
      renderedFlowItems: totalRenderedEdges,
      totalFlowItems: totalEdges,
      unresolved: totalUnresolved,
      containerSize,
      wrapperRect: graphRef.current?.getBoundingClientRect() || null,
      viewport: flow?.getViewport() || null,
      zoom,
      nodeDimensions: flow
        ? flow.getNodes().slice(0, 12).map((n) => ({
            id: n.id,
            x: n.position.x,
            y: n.position.y,
            width: n.width ?? null,
            height: n.height ?? null,
            hidden: Boolean(n.hidden),
          }))
        : [],
      filters,
      quickFilters,
    };
    (window as unknown as { __networkGraphDiagnostics?: unknown }).__networkGraphDiagnostics = payload;
    console.info('[NetworkVisualizer diagnostics]', payload);
  }, [
    selectedSubNetwork,
    nodes.length,
    edges.length,
    totalRenderedEdges,
    totalEdges,
    totalUnresolved,
    containerSize,
    flow,
    zoom,
    filters,
    quickFilters,
  ]);

  const handleToggleProtocol = useCallback((protocol: keyof NetworkTrafficFilters['protocolFilter']) => {
    setFilters((prev) => ({
      ...prev,
      protocolFilter: {
        ...prev.protocolFilter,
        [protocol]: !prev.protocolFilter[protocol],
      },
    }));
  }, []);

  const handleQuickProtocol = useCallback((protocol: TrafficProtocol) => {
    setQuickFilters((prev) => ({
      ...prev,
      protocolFilter: {
        ...prev.protocolFilter,
        [protocol]: !prev.protocolFilter[protocol],
      },
    }));
  }, []);

  const handleQuickResolution = useCallback((status: RowHealth) => {
    setQuickFilters((prev) => ({
      ...prev,
      resolutionFilter: {
        ...prev.resolutionFilter,
        [status]: !prev.resolutionFilter[status],
      },
    }));
  }, []);

  const handleSelectRow = useCallback((portKey: string) => {
    if (!view) {
      return;
    }
    setSelectedPortKey(portKey);
    setDetailsTab('summary');
  }, [view]);

  const handleToggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const handleExportSummaryCsv = useCallback(() => {
    if (!fullView) {
      return;
    }
    const rows = buildNetworkPortSummaryRows(fullView);
    onExportBlob(
      networkPortSummaryCsv(rows),
      `network-port-summary-${fullView.selectedSubNetwork}-${fileName || 'scl'}.csv`,
      'text/csv;charset=utf-8;',
    );
  }, [fullView, onExportBlob, fileName]);

  const handleExportFiltersCsv = useCallback(() => {
    if (!fullView) {
      return;
    }
    const rows = buildNetworkPortFilterRows(fullView);
    onExportBlob(
      networkPortFiltersCsv(rows),
      `network-port-filters-${fullView.selectedSubNetwork}-${fileName || 'scl'}.csv`,
      'text/csv;charset=utf-8;',
    );
  }, [fullView, onExportBlob, fileName]);

  const handleExportJson = useCallback(() => {
    if (!fullView) {
      return;
    }
    onExportBlob(
      JSON.stringify(
        {
          subNetwork: fullView.selectedSubNetwork,
          summary: buildNetworkPortSummaryRows(fullView),
          filters: buildNetworkPortFilterRows(fullView),
        },
        null,
        2,
      ),
      `network-port-report-${fullView.selectedSubNetwork}-${fileName || 'scl'}.json`,
      'application/json',
    );
  }, [fullView, onExportBlob, fileName]);

  if (!model) {
    return (
      <ThreePaneLayout
        storageKey="network"
        left={(
        <aside className="panel navigator-panel">
          <h2>Network Visualizer</h2>
          <p className="hint">Load an SCD file to inspect network ports and traffic.</p>
        </aside>
        )}
        center={(
          <section className="panel canvas-panel">
          <p className="hint">No network data.</p>
          </section>
        )}
        right={(
          <aside className="panel inspector-panel">
          <h2>Inspector</h2>
          <p className="hint">Select an IED port row or a port-to-switch link.</p>
          </aside>
        )}
      />
    );
  }

  return (
    <ThreePaneLayout
      storageKey={`network:${selectedSubNetwork || 'none'}`}
      className="network-layout"
      initialLeftWidth={260}
      initialRightWidth={260}
      left={(
        <aside className="panel navigator-panel">
        <div className="panel-title-row">
          <h2>Network Visualizer</h2>
        </div>

        <div className="filter-grid">
          <select
            className="input"
            value={selectedSubNetwork}
            onChange={(e) => {
              setSelectedSubNetwork(e.target.value);
              setSelectedPortKey(null);
            }}
            disabled={subNetworks.length <= 1}
          >
            {subNetworks.length === 0 ? <option value="">No SubNetwork found</option> : null}
            {subNetworks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={filters.direction}
            onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value as NetworkTrafficFilters['direction'] }))}
          >
            <option value="both">Direction: both</option>
            <option value="in">Direction: in</option>
            <option value="out">Direction: out</option>
          </select>

          <select
            className="input"
            value={filters.resolution}
            onChange={(e) => setFilters((prev) => ({ ...prev, resolution: e.target.value as NetworkTrafficFilters['resolution'] }))}
          >
            <option value="all">Resolution: all</option>
            <option value="resolved">Resolution: resolved</option>
            <option value="unresolved">Resolution: unresolved</option>
          </select>
        </div>

        <div className="chip-group">
          <Chip active={filters.protocolFilter.GOOSE} onClick={() => handleToggleProtocol('GOOSE')}>GOOSE</Chip>
          <Chip active={filters.protocolFilter.SV} onClick={() => handleToggleProtocol('SV')}>SV</Chip>
          <Chip active={filters.protocolFilter.REPORT} onClick={() => handleToggleProtocol('REPORT')}>REPORT</Chip>
        </div>

        <div className="network-quick-filters">
          <input
            className="input"
            placeholder="Search IED"
            value={quickFilters.search}
            onChange={(e) => setQuickFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <div className="chip-group">
            <Chip active={quickFilters.protocolFilter.GOOSE} onClick={() => handleQuickProtocol('GOOSE')}>Q GOOSE</Chip>
            <Chip active={quickFilters.protocolFilter.SV} onClick={() => handleQuickProtocol('SV')}>Q SV</Chip>
            <Chip active={quickFilters.protocolFilter.REPORT} onClick={() => handleQuickProtocol('REPORT')}>Q REPORT</Chip>
          </div>
          <div className="chip-group">
            <Chip active={quickFilters.resolutionFilter.resolved} onClick={() => handleQuickResolution('resolved')}>resolved</Chip>
            <Chip active={quickFilters.resolutionFilter.probable} onClick={() => handleQuickResolution('probable')}>probable</Chip>
            <Chip active={quickFilters.resolutionFilter.unresolved} onClick={() => handleQuickResolution('unresolved')}>unresolved</Chip>
          </div>
          <div className="filter-grid">
            <select
              className="input"
              value={quickFilters.deviceType}
              onChange={(e) => setQuickFilters((prev) => ({ ...prev, deviceType: e.target.value as TableQuickFilters['deviceType'] }))}
            >
              <option value="all">Device: all</option>
              <option value="F">Device: F</option>
              <option value="S1">Device: S1</option>
              <option value="P1">Device: P1</option>
            </select>
            <label className="toggle-check">
              <input
                type="checkbox"
                checked={quickFilters.unresolvedOnly}
                onChange={(e) => setQuickFilters((prev) => ({ ...prev, unresolvedOnly: e.target.checked }))}
              />
              unresolved &gt; 0
            </label>
          </div>
        </div>

        <div className="tabs-row wrap">
          <Button onClick={handleExportSummaryCsv}>Network Port Summary CSV</Button>
          <Button onClick={handleExportFiltersCsv}>Network Port Filters CSV</Button>
          <Button onClick={handleExportJson}>Network Port JSON</Button>
        </div>

        <NetworkPortTable rows={tableRows} selectedPortKey={selectedPortKey} onSelectRow={handleSelectRow} />
      </aside>
      )}

      center={(
        <section className="panel canvas-panel">
        <div className="canvas-toolbar">
          <div className="chip-group">
            <span className="chip">
              SubNetwork {view?.selectedSubNetwork || '-'} · Ports: {view?.ports.length || 0} · Edges: {totalEdges} · Unresolved: {totalUnresolved}
            </span>
            <span className="chip">Rendered: {totalRenderedEdges}</span>
            <span className="chip">Zoom: {zoom.toFixed(2)}</span>
          </div>
          <div className="chip-group">
            <label className="toggle-check">
              <input
                type="checkbox"
                checked={showDebugRawList}
                onChange={(e) => setShowDebugRawList(e.target.checked)}
              />
              Show raw list (debug)
            </label>
            <Button onClick={handleFitView}>Fit View</Button>
            <Button onClick={handleDiagnostics}>Diagnostics</Button>
            <Button onClick={() => setShowHeat((v) => !v)} title="Color nodes and edges by traffic estimate">
              {showHeat ? 'Heat ON' : 'Heat OFF'}
            </Button>
            <Button
              onClick={() => printNetworkSummary(model, selectedSubNetwork || undefined)}
              disabled={!model}
            >
              Export PDF
            </Button>
          </div>
        </div>
        {showDebugRawList ? (
          <div className="debug-raw-list">
            <strong>Raw IED/Port List</strong>
            {view?.ports.map((port) => (
              <p key={`raw:${port.key}`} className="hint">
                {port.iedName} / {port.apName}
              </p>
            ))}
            {view?.ports.length === 0 ? <p className="hint">No ports in selected SubNetwork.</p> : null}
          </div>
        ) : null}
        <div ref={graphRef} className="graph-canvas">
          {showHeat ? (
            <div className="net-traffic-legend" aria-hidden="true">
              <div className="net-traffic-legend-title">Traffic</div>
              <div className="net-traffic-legend-row">
                <span className="net-traffic-legend-line" style={{ background: 'var(--mms)' }} />
                <span>— &lt; 1 Mbps</span>
              </div>
              <div className="net-traffic-legend-row">
                <span className="net-traffic-legend-line" style={{ background: 'var(--goose)' }} />
                <span>— 1–10 Mbps</span>
              </div>
              <div className="net-traffic-legend-row">
                <span className="net-traffic-legend-line" style={{ background: 'var(--sv)' }} />
                <span>— 10+ Mbps</span>
              </div>
              <div className="net-traffic-legend-divider" />
              <div className="net-traffic-legend-squares">
                <span className="net-traffic-legend-square net-node-cold" />
                <span>Cold</span>
                <span className="net-traffic-legend-square net-node-warm" />
                <span>Warm</span>
                <span className="net-traffic-legend-square net-node-hot" />
                <span>Hot</span>
                <span className="net-traffic-legend-square net-node-fire" />
                <span>Fire</span>
              </div>
            </div>
          ) : null}
          {!hasRenderableContainer ? (
            <div className="graph-empty-state">
              <p className="hint">Canvas is not ready yet (container has no size).</p>
            </div>
          ) : nodes.length === 0 || edges.length === 0 ? (
            <div className="graph-empty-state">
              <p className="hint">Empty/LOD hidden state: no visible nodes or edges for current filters.</p>
            </div>
          ) : (
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onInit={handleInit}
                onMove={handleMove}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                nodeTypes={EMPTY_NODE_TYPES}
                edgeTypes={EMPTY_EDGE_TYPES}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                fitView
                fitViewOptions={{ ...FIT_VIEW_OPTIONS, minZoom: 0.05 }}
                minZoom={0.01}
                maxZoom={2}
                attributionPosition="bottom-left"
              >
                <Background gap={18} size={1} />
                <MiniMap position="bottom-right" zoomable pannable />
                <Controls />
              </ReactFlow>
            </ReactFlowProvider>
          )}
        </div>
      </section>
      )}

      right={(
        <aside className="panel inspector-panel network-inspector">
        <div className="panel-title-row">
          <h2>Port Traffic Details</h2>
          <span className="file-pill">{selectedPort ? `${selectedPort.iedName}/${selectedPort.apName}` : 'No port selected'}</span>
        </div>

        <div className="tabs-row wrap">
          <button className={detailsTab === 'summary' ? 'active' : ''} onClick={() => setDetailsTab('summary')}>Summary</button>
          <button className={detailsTab === 'GOOSE' ? 'active' : ''} onClick={() => setDetailsTab('GOOSE')}>GOOSE</button>
          <button className={detailsTab === 'SV' ? 'active' : ''} onClick={() => setDetailsTab('SV')}>SV</button>
          <button className={detailsTab === 'REPORT' ? 'active' : ''} onClick={() => setDetailsTab('REPORT')}>REPORT</button>
          <button className={detailsTab === 'issues' ? 'active' : ''} onClick={() => setDetailsTab('issues')}>Issues</button>
        </div>

        {!selectedPort ? <p className="hint">Select a port row from the table.</p> : null}

        {selectedPort && detailsTab === 'summary' ? (
          <div className="tab-content">
            <div className="summary-grid compact">
              <article className="info-card">
                <h4>IED</h4>
                <p>{selectedPort.iedName}</p>
                <p className="hint">{selectedIedInfo?.desc || '-'}</p>
              </article>
              <article className="info-card">
                <h4>Port</h4>
                <p>{selectedPort.apName}</p>
                <p className="hint">IP: {selectedPort.ip || '-'} · MAC: {selectedPort.mac || '-'}</p>
              </article>
              <article className="info-card">
                <h4>Totals</h4>
                <p>GOOSE o/i: {selectedPort.filteredCounts.GOOSE.out}/{selectedPort.filteredCounts.GOOSE.in}</p>
                <p>SV o/i: {selectedPort.filteredCounts.SV.out}/{selectedPort.filteredCounts.SV.in}</p>
                <p>REPORT o/i: {selectedPort.filteredCounts.REPORT.out}/{selectedPort.filteredCounts.REPORT.in}</p>
                <p className="hint">Unresolved: {selectedPort.filteredCounts.unresolved}</p>
              </article>
            </div>

            <div className="summary-grid compact">
              <article className="info-card">
                <h4>Top Publishers</h4>
                {topPublishers.length === 0 ? <p className="hint">-</p> : topPublishers.map((row) => <p key={`pub:${row.name}`} className="hint">{row.name}: {row.count}</p>)}
              </article>
              <article className="info-card">
                <h4>Top Subscribers</h4>
                {topSubscribers.length === 0 ? <p className="hint">-</p> : topSubscribers.map((row) => <p key={`sub:${row.name}`} className="hint">{row.name}: {row.count}</p>)}
              </article>
              <article className="info-card">
                <h4>Comm Params</h4>
                <p className="hint">VLAN: {formatDistribution(vlanDist)}</p>
                <p className="hint">PRIO: {formatDistribution(prioDist)}</p>
                <p className="hint">APPID: {formatDistribution(appidDist)}</p>
              </article>
            </div>

            <div className="summary-grid compact">
              <article className="info-card">
                <h4>Estimated Traffic (Heuristic)</h4>
                <p>Total: {formatRate(trafficEstimate.totalKbps)}</p>
                <p>IN: {formatRate(trafficEstimate.inKbps)} · OUT: {formatRate(trafficEstimate.outKbps)}</p>
                <p className="hint">
                  GOOSE: {formatRate(trafficEstimate.byProtocol.GOOSE)} · SV: {formatRate(trafficEstimate.byProtocol.SV)} · REPORT: {formatRate(trafficEstimate.byProtocol.REPORT)}
                </p>
                <p className="hint">Assumption: GOOSE 10 fps, SV 4000 fps, REPORT 2 fps.</p>
              </article>
            </div>
          </div>
        ) : null}

        {selectedPort && (detailsTab === 'GOOSE' || detailsTab === 'SV' || detailsTab === 'REPORT') ? (
          <div className="tab-content">
            {groupItems
              .map((group) => ({
                ...group,
                items: sortByDirectionInThenOut(group.items.filter((item) => item.protocol === detailsTab)),
              }))
              .filter((group) => group.items.length > 0)
              .map((group) => {
                const collapsed = collapsedGroups[group.key] || false;
                const inItems = group.items.filter((item) => item.direction === 'in');
                const outItems = group.items.filter((item) => item.direction === 'out');
                return (
                  <div key={group.key} className="protocol-group">
                    <button className="group-toggle" onClick={() => handleToggleGroup(group.key)}>
                      <strong>{group.key}</strong>
                      <span className="hint">{group.items.length} items</span>
                    </button>
                    {!collapsed ? (
                      <div className="detail-virtual-sections">
                        {inItems.length > 0 ? (
                          <>
                            <p className="detail-direction-title">IN ({inItems.length})</p>
                            <VirtualList
                              items={inItems}
                              rowHeight={DETAIL_ROW_HEIGHT}
                              height={Math.min(260, Math.max(84, inItems.length * DETAIL_ROW_HEIGHT))}
                              className="detail-virtual"
                              itemKey={(item, index) => flowItemKey(item, `${group.key}:in:${index}`)}
                              renderRow={(item) => <TrafficRow item={item} />}
                            />
                          </>
                        ) : null}
                        {outItems.length > 0 ? (
                          <>
                            <p className="detail-direction-title">OUT ({outItems.length})</p>
                            <VirtualList
                              items={outItems}
                              rowHeight={DETAIL_ROW_HEIGHT}
                              height={Math.min(260, Math.max(84, outItems.length * DETAIL_ROW_HEIGHT))}
                              className="detail-virtual"
                              itemKey={(item, index) => flowItemKey(item, `${group.key}:out:${index}`)}
                              renderRow={(item) => <TrafficRow item={item} />}
                            />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            {filterProtocolItems(detailsItems, detailsTab as TrafficProtocol, quickFilters.resolutionFilter).length === 0 ? (
              <p className="hint">No traffic for selected protocol and filters.</p>
            ) : null}
          </div>
        ) : null}

        {selectedPort && detailsTab === 'issues' ? (
          <VirtualList
            items={unresolvedItems(detailsItems)}
            rowHeight={DETAIL_ROW_HEIGHT}
            height={360}
            className="detail-virtual"
            itemKey={(item, index) => flowItemKey(item, `issues:${index}`)}
            renderRow={(item) => <TrafficRow item={item} />}
          />
        ) : null}
      </aside>
      )}
    />
  );
}

function computeTrafficByIed(view: NetworkTopologyView): Map<string, number> {
  const map = new Map<string, number>();
  for (const link of view.links) {
    for (const item of link.filteredFlowItems) {
      const prev = map.get(item.iedName) ?? 0;
      map.set(item.iedName, prev + estimateFlowKbps(item));
    }
  }
  return map;
}

function trafficNodeClass(totalKbps: number): 'net-node-cold' | 'net-node-warm' | 'net-node-hot' | 'net-node-fire' {
  if (totalKbps < 500) return 'net-node-cold';
  if (totalKbps < 2000) return 'net-node-warm';
  if (totalKbps < 7000) return 'net-node-hot';
  return 'net-node-fire';
}

function trafficEdgeStyle(totalKbps: number): { stroke: string; strokeWidth: number } {
  if (totalKbps < 1000) return { stroke: 'var(--mms)', strokeWidth: 1.5 };
  if (totalKbps < 10_000) return { stroke: 'var(--goose)', strokeWidth: 2.5 };
  return { stroke: 'var(--sv)', strokeWidth: 4 };
}

function buildGraph(
  view: NetworkTopologyView,
  trafficByIed: Map<string, number>,
  showHeat: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const iedNames = Array.from(new Set(
    view.ports
      .filter((port): port is typeof port & { iedName: string } => Boolean(port.iedName))
      .map((port) => port.iedName)
  )).sort((a, b) => a.localeCompare(b));

  const switchPositions = new Map<string, XYPosition>();
  if (view.switches.length === 1) {
    switchPositions.set(view.switches[0].id, { x: 620, y: 320 });
  } else {
    view.switches.forEach((sw, idx) => {
      switchPositions.set(sw.id, { x: 380 + idx * 250, y: 210 });
    });
  }

  for (const sw of view.switches) {
    nodes.push({
      id: sw.id,
      position: switchPositions.get(sw.id) || { x: 620, y: 320 },
      data: { label: sw.name },
      draggable: false,
      style: {
        border: '2px solid #0c63b4',
        background: '#eaf4ff',
        fontWeight: 700,
        minWidth: 180,
        textAlign: 'center',
      },
    });
  }

  const center = averagePoint(Array.from(switchPositions.values()));
  const radius = Math.max(260, 220 + iedNames.length * 9);
  iedNames.forEach((iedName, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(iedNames.length, 1);
    const iedPos: XYPosition = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    nodes.push({
      id: `ied:${iedName}`,
      position: iedPos,
      className: showHeat ? trafficNodeClass(trafficByIed.get(iedName) ?? 0) : undefined,
      data: { label: showHeat ? `${iedName}\n${formatRate(trafficByIed.get(iedName) ?? 0)}` : iedName },
      style: {
        border: '1px solid #adc5dd',
        background: '#f7fbff',
        minWidth: 130,
        whiteSpace: showHeat ? ('pre-line' as const) : undefined,
      },
    });

    const ports = view.ports.filter((port) => port.iedName === iedName);
    ports.forEach((port, idx) => {
      const link = view.links.find((item) => item.portKey === port.key);
      if (link) {
        const dominant = dominantProtocol(link.filteredFlowItems);
        const trafficTotalKbps = trafficByIed.get(iedName) ?? 0;
        const edgeHeat = showHeat ? trafficEdgeStyle(trafficTotalKbps) : null;
        edges.push({
          id: link.id,
          source: `ied:${iedName}`,
          target: link.switchId,
          data: { kind: 'traffic', linkId: link.id },
          style: {
            stroke: edgeHeat ? edgeHeat.stroke : protocolStroke(dominant),
            strokeWidth: edgeHeat ? edgeHeat.strokeWidth : 1.9,
            opacity: Math.max(0.35, 1 - idx * 0.12),
          },
        });
      }
    });
  });

  return { nodes, edges };
}

function dominantProtocol(items: PortFlowItem[]): TrafficProtocol {
  const counts: Record<TrafficProtocol, number> = {
    GOOSE: 0,
    SV: 0,
    REPORT: 0,
  };
  for (const item of items) {
    counts[item.protocol] += 1;
  }
  if (counts.GOOSE >= counts.SV && counts.GOOSE >= counts.REPORT) {
    return 'GOOSE';
  }
  if (counts.REPORT >= counts.SV) {
    return 'REPORT';
  }
  return 'SV';
}

function protocolStroke(protocol: TrafficProtocol): string {
  if (protocol === 'GOOSE') {
    return '#d10000';
  }
  if (protocol === 'REPORT') {
    return '#0f5fd7';
  }
  return '#111111';
}

function TrafficRow({ item }: { item: PortFlowItem }): JSX.Element {
  const reason = item.status === 'probable' ? item.message || 'Inferred mapping.' : item.message;
  const signalId =
    item.protocol === 'GOOSE'
      ? `GOOSE ${item.controlBlockName || item.appId || '-'}`
      : item.protocol === 'SV'
        ? `SV ${item.controlBlockName || item.appId || '-'}`
        : `REPORT ${item.controlBlockName || '-'}`;
  const peerText = item.direction === 'in' ? `FROM ${item.sourceIed}` : `TO ${item.destinationIed}`;
  return (
    <div className="traffic-row-compact">
      <span className="traffic-status">
        <b className={`badge badge-${item.status}`} title={reason || ''}>{item.status}</b>
      </span>
      <span className="traffic-direction">
        <b className="badge neutral">{item.direction.toUpperCase()}</b>
      </span>
      <span className="traffic-peer" title={peerText}>{peerText}</span>
      <span className="traffic-signal-id" title={signalId}>{signalId}</span>
      <span className="traffic-dataset" title={item.dataSetName || '-'}>{item.dataSetName || '-'}</span>
      <span
        className="traffic-l2"
        title={`mac:${item.multicastDstMac || '-'} vlan:${item.vlanId || '-'} prio:${item.vlanPriority || '-'} appid:${item.appId || '-'}`}
      >
        mac:{item.multicastDstMac || '-'} vlan:{item.vlanId || '-'} prio:{item.vlanPriority || '-'} appid:{item.appId || '-'}
      </span>
    </div>
  );
}

function flowItemKey(item: PortFlowItem, fallback: string): string {
  const key = [
    item.protocol,
    item.direction,
    item.sourceIed,
    item.destinationIed,
    item.controlBlockName || '',
    item.dataSetName || '',
    item.appId || '',
    item.multicastDstMac || '',
    item.vlanId || '',
    item.vlanPriority || '',
  ]
    .join('|')
    .trim();
  return key || fallback;
}

function averagePoint(points: XYPosition[]): XYPosition {
  if (points.length === 0) {
    return { x: 620, y: 320 };
  }
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function topTalkers(items: PortFlowItem[], field: 'sourceIed' | 'destinationIed'): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item[field] || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function distribution(items: PortFlowItem[], field: 'vlanId' | 'vlanPriority' | 'appId'): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = (item[field] || '').trim();
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function formatDistribution(rows: Array<{ value: string; count: number }>): string {
  if (rows.length === 0) {
    return '-';
  }
  return rows.map((row) => `${row.value}(${row.count})`).join(', ');
}

function estimateTraffic(items: PortFlowItem[]): {
  inKbps: number;
  outKbps: number;
  totalKbps: number;
  byProtocol: Record<TrafficProtocol, number>;
} {
  const unique = new Map<string, PortFlowItem>();
  for (const item of items) {
    // Avoid overcounting multicast publishers when one stream has many subscribers.
    const key = [
      item.protocol,
      item.direction,
      item.sourceIed,
      item.destinationIed,
      item.controlBlockName || '',
      item.appId || '',
      item.multicastDstMac || '',
      item.vlanId || '',
    ].join('|');
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  const byProtocol: Record<TrafficProtocol, number> = {
    GOOSE: 0,
    SV: 0,
    REPORT: 0,
  };
  let inKbps = 0;
  let outKbps = 0;

  for (const item of unique.values()) {
    const kbps = estimateFlowKbps(item);
    byProtocol[item.protocol] += kbps;
    if (item.direction === 'in') {
      inKbps += kbps;
    } else {
      outKbps += kbps;
    }
  }

  return {
    inKbps,
    outKbps,
    totalKbps: inKbps + outKbps,
    byProtocol,
  };
}

function estimateFlowKbps(item: PortFlowItem): number {
  // Heuristic defaults for commissioning-level sizing.
  // kbps = bytes * 8 * pps / 1000
  if (item.protocol === 'GOOSE') {
    return (250 * 8 * 10) / 1000;
  }
  if (item.protocol === 'SV') {
    return (220 * 8 * 4000) / 1000;
  }
  return (300 * 8 * 2) / 1000;
}

function formatRate(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(2)} Mbps`;
  }
  return `${kbps.toFixed(1)} kbps`;
}

function sortByDirectionInThenOut(items: PortFlowItem[]): PortFlowItem[] {
  const rank = { in: 0, out: 1 } as const;
  return [...items].sort((a, b) => {
    if (rank[a.direction] !== rank[b.direction]) {
      return rank[a.direction] - rank[b.direction];
    }
    const nameA = a.controlBlockName || '';
    const nameB = b.controlBlockName || '';
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    return (a.appId || '').localeCompare(b.appId || '');
  });
}
