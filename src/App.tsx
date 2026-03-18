import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { parseSclDocument } from './parser/sclParser';
import TopBar from './components/TopBar';
import { Button, Chip, EmptyState } from './components/ui';
import SubstationTree from './components/SubstationTree';
import GraphCanvas from './components/GraphCanvas';
import InspectorPanel from './components/InspectorPanel';
import CommandPalette from './components/CommandPalette';
import CompareBar from './components/CompareBar';
import IssuesWorkspace from './components/IssuesWorkspace';
import StatisticsWorkspace from './components/StatisticsWorkspace';
import ChangesPanel from './components/ChangesPanel';
import NetworkVisualizerPanel from './components/NetworkVisualizerPanel';
import ValidationMatrix from './components/ValidationMatrix';
import ThreePaneLayout from './components/ThreePaneLayout';
import { changesCsv, detailedFlowsCsv, gooseMatrixCsv, protocolSummaryCsv, validationCsv } from './utils/exportCsv';
import { downloadExcelIp, type ExportSheetsOption } from './utils/exportExcel';
import { landsnetJsonFiles } from './utils/exportLandsnetJson';
import { Toaster, useToast } from './components/ui/Toast';
import { deriveVisibleGraph } from './utils/graphVisibility';
import { UiStoreProvider, useUiStore } from './state/uiStore';
import { ValidationProvider, useValidationStore } from './state/validationStore';
import { useModelValidation } from './state/useModelValidation';
import { useSclFiles } from './state/useSclFiles';
import { useCompareState, type ChangeFilters } from './state/useCompareState';
import { buildDiffReport } from './diff/report';

export default function App(): JSX.Element {
  return (
    <UiStoreProvider>
      <ValidationProvider>
        <AppInner />
      </ValidationProvider>
    </UiStoreProvider>
  );
}

function AppInner(): JSX.Element {
  const [appMode, setAppMode] = useState<'visualizer' | 'network' | 'issues' | 'compare' | 'statistics'>('visualizer');
  const [commandOpen, setCommandOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileSizeWarning, setFileSizeWarning] = useState<{ file: File; callback: (xml: string, name: string) => void; mb: string } | null>(null);
  const { toasts, showToast, dismiss } = useToast();

  const [compareVariant, setCompareVariant] = useState<'single' | 'compare'>('single');
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [changeFilters, setChangeFilters] = useState<ChangeFilters>({ type: 'all', area: 'all', query: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const baselineInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const { state: ui, dispatch } = useUiStore();
  const { state: vstate, dispatch: vdispatch } = useValidationStore();

  const {
    fileName,
    model,
    baselineModel,
    baselineName,
    newModel,
    newName,
    error,
    applyParsedMain,
    applyParsedBaseline,
    applyParsedNew,
  } = useSclFiles(dispatch);

  const activeModel = appMode === 'compare' && compareVariant === 'compare' ? newModel : model;
  const landsnetReport = useModelValidation(activeModel, vdispatch);

  const visibleBase = useMemo(() => deriveVisibleGraph(activeModel, ui), [activeModel, ui]);
  const { diff, selectedChange, compareChanges } = useCompareState({
    baselineModel,
    newModel,
    compareVariant,
    showOnlyChanges,
    selectedChangeId,
  });

  const visible = useMemo(() => {
    if (!activeModel) {
      return visibleBase;
    }
    if (visibleBase.visibleIeds.length > 0) {
      return visibleBase;
    }
    const fallbackIed = activeModel.ieds[0];
    if (!fallbackIed) {
      return visibleBase;
    }
    const fallbackEdges = activeModel.edges.filter(
      (edge) => edge.publisherIed === fallbackIed.name || edge.subscriberIed === fallbackIed.name,
    );
    return {
      ...visibleBase,
      visibleIeds: [fallbackIed],
      visibleEdges: fallbackEdges,
    };
  }, [activeModel, visibleBase]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isCmdK) {
        return;
      }
      event.preventDefault();
      setCommandOpen((v) => !v);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!activeModel) {
      return;
    }
    const hasValidFocus = Boolean(ui.focusIedId && activeModel.ieds.some((ied) => ied.name === ui.focusIedId));
    if (hasValidFocus) {
      return;
    }
    const first = activeModel.ieds[0]?.name ?? null;
    dispatch({ type: 'set-focus', payload: first });
    if (first) {
      dispatch({ type: 'set-selected', payload: { type: 'ied', id: `ied:${first}` } });
      dispatch({ type: 'request-fit' });
    }
  }, [activeModel, ui.focusIedId, dispatch]);

  useEffect(() => {
    if (!activeModel) {
      return;
    }
    const noVisibleGraph = visibleBase.visibleIeds.length === 0 && visibleBase.visibleEdges.length === 0;
    if (!noVisibleGraph) {
      return;
    }
    if (!ui.hideIsolated || ui.searchQuery.trim().length > 0) {
      return;
    }
    if (activeModel.edges.length > 0) {
      dispatch({ type: 'set-hide-isolated', payload: false });
    }
  }, [
    activeModel,
    visibleBase.visibleIeds.length,
    visibleBase.visibleEdges.length,
    ui.hideIsolated,
    ui.searchQuery,
    dispatch,
  ]);

  async function loadExample(path: string): Promise<void> {
    const res = await fetch(path);
    const text = await res.text();
    parseAndSetModel(text, path.split('/').pop() || path);
  }

  function parseAndSetModel(xml: string, name: string): void {
    const result = parseSclDocument(xml);
    setAppMode('visualizer');
    applyParsedMain(result, name);
  }

  function parseAndSetBaseline(xml: string, name: string): void {
    const result = parseSclDocument(xml);
    applyParsedBaseline(result, name, () => {
      setSelectedChangeId(null);
    });
  }

  function parseAndSetNew(xml: string, name: string): void {
    const result = parseSclDocument(xml);
    applyParsedNew(result, name, () => {
      setSelectedChangeId(null);
    });
  }

  const FILE_SIZE_WARN_BYTES = 50 * 1024 * 1024; // 50 MB

  function doReadFile(file: File, callback: (xml: string, name: string) => void): void {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      // setTimeout(0) lets React render the loading overlay before the
      // synchronous parse blocks the main thread.
      window.setTimeout(() => {
        try {
          callback(String(reader.result), file.name);
        } finally {
          setLoading(false);
        }
      }, 0);
    };
    reader.onerror = () => setLoading(false);
    reader.readAsText(file);
  }

  function readFile(file: File, callback: (xml: string, name: string) => void): void {
    if (file.size > FILE_SIZE_WARN_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setFileSizeWarning({ file, callback, mb });
      return;
    }
    doReadFile(file, callback);
  }

  function exportBlob(content: string, file: string, mime = 'text/plain;charset=utf-8;'): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${file}`);
  }

  function exportGoose(): void {
    if (!activeModel) {
      return;
    }
    exportBlob(gooseMatrixCsv(activeModel.edges), `goose-matrix-${fileName || 'scl'}.csv`, 'text/csv;charset=utf-8;');
  }

  function exportGooseDetailed(): void {
    if (!activeModel) {
      return;
    }
    exportBlob(
      detailedFlowsCsv(activeModel, 'GOOSE'),
      `goose-detailed-${fileName || 'scl'}.csv`,
      'text/csv;charset=utf-8;',
    );
  }

  function exportAllFlows(): void {
    if (!activeModel) {
      return;
    }
    exportBlob(
      detailedFlowsCsv(activeModel, 'ALL'),
      `flows-all-${fileName || 'scl'}.csv`,
      'text/csv;charset=utf-8;',
    );
  }

  function exportProtocolSummary(): void {
    if (!activeModel) {
      return;
    }
    exportBlob(
      protocolSummaryCsv(activeModel),
      `protocol-summary-${fileName || 'scl'}.csv`,
      'text/csv;charset=utf-8;',
    );
  }

  function exportLandsnetJson(): void {
    if (!landsnetReport) {
      return;
    }
    const files = landsnetJsonFiles(landsnetReport);
    files.forEach((file, index) => {
      window.setTimeout(() => {
        exportBlob(file.content, file.fileName, file.mime);
      }, index * 80);
    });
  }

  function exportExcelIp(sheetsOption: ExportSheetsOption = 'all'): void {
    if (!activeModel) {
      return;
    }
    const baseName = (fileName || 'scl').replace(/\.(scd|xml|cid|icd)$/i, '');
    downloadExcelIp(activeModel, fileName || 'scl', sheetsOption);
    showToast(`Exported ${baseName}-export.xlsx`);
  }

  const selectedIedName = ui.selectedEntity.type === 'ied'
    ? ui.selectedEntity.id.replace('ied:', '')
    : ui.focusIedId ?? undefined;

  function selectIed(iedName: string) {
    dispatch({ type: 'set-selected', payload: { type: 'ied', id: `ied:${iedName}` } });
    dispatch({ type: 'set-focus', payload: iedName });
    dispatch({ type: 'request-fit' });
  }

  const centerViewItems: Array<{ id: typeof appMode; label: string; icon: string }> = [
    { id: 'visualizer', label: 'Graph', icon: '⬡' },
    { id: 'issues', label: 'Validation', icon: '✓' },
    { id: 'compare', label: 'Compare', icon: '⟷' },
    { id: 'network', label: 'Network', icon: '⋯' },
    { id: 'statistics', label: 'Statistics', icon: '≡' },
  ];

  // canvas tabs keep sidebars; report tabs auto-collapse them
  // Network has its own internal ThreePaneLayout so outer sidebars waste space
  const isReportTab = appMode === 'issues' || appMode === 'compare' || appMode === 'statistics' || appMode === 'network';

  return (
    <div className="app-shell-v2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".scd,.xml,.cid,.icd"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            readFile(file, parseAndSetModel);
          }
        }}
      />
      <input
        ref={baselineInputRef}
        type="file"
        accept=".scd,.xml,.cid,.icd"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            readFile(file, parseAndSetBaseline);
          }
        }}
      />
      <input
        ref={newInputRef}
        type="file"
        accept=".scd,.xml,.cid,.icd"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            readFile(file, parseAndSetNew);
          }
        }}
      />

      <TopBar
        appMode={appMode}
        issueCount={vstate.issues.length}
        fileName={appMode === 'compare' ? `${baselineName || 'A ?'} vs ${newName || 'B ?'}` : fileName}
        onSetAppMode={setAppMode}
        onOpenFile={() => fileInputRef.current?.click()}
        onLoadExample={(path) => void loadExample(path)}
        onOpenCommand={() => setCommandOpen(true)}
        onExportGooseCsv={exportGoose}
        onExportGooseDetailedCsv={exportGooseDetailed}
        onExportAllFlowsCsv={exportAllFlows}
        onExportProtocolSummaryCsv={exportProtocolSummary}
        onExportLandsnetJson={exportLandsnetJson}
        onExportExcelIp={exportExcelIp}
      />

      {!model && !error ? (
        <EmptyState
          ariaLabel="No file loaded"
          title="Load an SCL file"
          description="Open an IEC 61850 SCL/SCD file to visualize the configuration, run validation, and compare versions."
          actions={
            <>
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                Load file
              </Button>
              <select
                className="input"
                defaultValue=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  void loadExample(value);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>Or load an example</option>
                <option value="/examples/example-basic.scd">Example 1 – Basic GOOSE/SV</option>
                <option value="/examples/example-unresolved.scd">Example 2 – Unresolved links</option>
              </select>
            </>
          }
        />
      ) : (
        <div className="app-main">
          {error ? (
            <section className="error-box">
              <h2>Parsing error</h2>
              <p>{error.message}</p>
              {error.line ? (
                <p>Line: {error.line} {error.column ? `Column: ${error.column}` : ''}</p>
              ) : null}
              <div className="error-actions">
                <Button onClick={() => fileInputRef.current?.click()}>Load another file</Button>
              </div>
            </section>
          ) : null}

          <div className="visualizer-view">
            <ThreePaneLayout
              storageKey="v2-main"
              collapseKey={appMode}
              autoCollapse={isReportTab}
              leftIcon="❖"
              rightIcon="ℹ"
              left={(
                <SubstationTree
                  substations={activeModel?.substations ?? []}
                  ieds={activeModel?.ieds ?? []}
                  issues={vstate.issues}
                  selectedIedName={selectedIedName}
                  onSelectIed={selectIed}
                />
              )}
              center={(
                <div className="center-panel-wrap">
                  {/* View switcher */}
                  <div className="center-view-bar">
                    {centerViewItems.map((item) => (
                      <button
                        key={item.id}
                        className={`center-view-btn ${appMode === item.id ? 'active' : ''}`}
                        onClick={() => setAppMode(item.id)}
                        title={item.label}
                      >
                        <span className="center-view-icon">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Graph view */}
                  {appMode === 'visualizer' ? (
                    <>
                      <section className="filter-strip">
                        <details className="ied-filter-dropdown" data-state={ui.iedFilter === 'all' ? 'all' : 'some'}>
                          <summary className="ied-filter-summary" title="Filter by IED">
                            {ui.iedFilter === 'all' ? 'IEDs: All' : `IEDs: ${ui.iedFilter.length} selected`}
                          </summary>
                          <div className="ied-filter-list" role="group" aria-label="Select IEDs">
                            <label className="ied-filter-option">
                              <input
                                type="checkbox"
                                checked={ui.iedFilter === 'all'}
                                onChange={(e) => {
                                  dispatch({ type: 'set-ied-filter', payload: e.target.checked ? 'all' : [] });
                                }}
                              />
                              <span>All IEDs</span>
                            </label>
                            {(activeModel?.ieds ?? []).map((ied) => {
                              const isChecked = ui.iedFilter === 'all' || ui.iedFilter.includes(ied.name);
                              return (
                                <label key={ied.name} className="ied-filter-option">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const next = ui.iedFilter === 'all'
                                          ? (activeModel?.ieds ?? []).map((i) => i.name)
                                          : [...ui.iedFilter, ied.name];
                                        dispatch({ type: 'set-ied-filter', payload: next });
                                      } else {
                                        const next = ui.iedFilter === 'all'
                                          ? (activeModel?.ieds ?? []).filter((i) => i.name !== ied.name).map((i) => i.name)
                                          : ui.iedFilter.filter((n) => n !== ied.name);
                                        dispatch({ type: 'set-ied-filter', payload: next });
                                      }
                                    }}
                                  />
                                  <span>{ied.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </details>
                        <div className="chip-group">
                          <Chip active={ui.protocolFilter.GOOSE} onClick={() => dispatch({ type: 'toggle-protocol', payload: 'GOOSE' })}>GOOSE</Chip>
                          <Chip active={ui.protocolFilter.SV} onClick={() => dispatch({ type: 'toggle-protocol', payload: 'SV' })}>SV</Chip>
                          <Chip active={ui.protocolFilter.REPORT} onClick={() => dispatch({ type: 'toggle-protocol', payload: 'REPORT' })}>REPORT</Chip>
                        </div>
                        <input
                          className="input"
                          value={ui.searchQuery}
                          placeholder="Filter IED/LN/DataSet/Control..."
                          onChange={(e) => dispatch({ type: 'set-search', payload: e.target.value })}
                        />
                        <select
                          className="input"
                          value={ui.directionFilter}
                          onChange={(e) => dispatch({ type: 'set-direction', payload: e.target.value as typeof ui.directionFilter })}
                        >
                          <option value="both">Dir: both</option>
                          <option value="incoming">Dir: in</option>
                          <option value="outgoing">Dir: out</option>
                        </select>
                        <select
                          className="input"
                          value={ui.resolutionFilter}
                          onChange={(e) => dispatch({ type: 'set-resolution', payload: e.target.value as typeof ui.resolutionFilter })}
                        >
                          <option value="all">Res: all</option>
                          <option value="resolved">Res: resolved</option>
                          <option value="unresolved">Res: unresolved</option>
                        </select>
                        <select
                          className="input"
                          value={String(ui.neighborDepth)}
                          onChange={(e) => {
                            const value = e.target.value;
                            dispatch({ type: 'set-neighbor-depth', payload: value === 'all' ? 'all' : Number(value) as 1 | 2 });
                          }}
                        >
                          <option value="1">Depth: 1</option>
                          <option value="2">Depth: 2</option>
                          <option value="all">Depth: all</option>
                        </select>
                        <label className="toggle-check">
                          <input
                            type="checkbox"
                            checked={ui.hideIsolated}
                            onChange={(e) => dispatch({ type: 'set-hide-isolated', payload: e.target.checked })}
                          />
                          Hide isolated
                        </label>
                      </section>
                      <GraphCanvas
                        ieds={visible.visibleIeds}
                        edges={visible.visibleEdges}
                        focusIedId={ui.focusIedId}
                        selectedEntity={ui.selectedEntity}
                        fitToken={ui.fitToken}
                        layoutCacheKey={fileName || 'single'}
                        filtersSnapshot={{
                          appMode,
                          protocolFilter: ui.protocolFilter,
                          directionFilter: ui.directionFilter,
                          resolutionFilter: ui.resolutionFilter,
                          neighborDepth: ui.neighborDepth,
                          hideIsolated: ui.hideIsolated,
                          searchQuery: ui.searchQuery,
                        }}
                        onSelectNode={(iedName) => {
                          dispatch({ type: 'set-focus', payload: iedName });
                          dispatch({ type: 'set-selected', payload: { type: 'ied', id: `ied:${iedName}` } });
                        }}
                        onSelectEdge={(edge) => {
                          dispatch({ type: 'set-selected', payload: { type: 'edge', id: edge.key } });
                          dispatch({ type: 'set-focus', payload: edge.publisherIed });
                        }}
                      />
                    </>
                  ) : null}

                  {/* Validation / Issues view */}
                  {appMode === 'issues' ? (
                    <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div className="validation-view-tabs" style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                        <button
                          className={`center-view-btn ${vstate.validationSubView !== 'matrix' ? 'active' : ''}`}
                          onClick={() => vdispatch({ type: 'set-validation-sub-view', payload: 'list' })}
                        >Issues list</button>
                        <button
                          className={`center-view-btn ${vstate.validationSubView === 'matrix' ? 'active' : ''}`}
                          onClick={() => vdispatch({ type: 'set-validation-sub-view', payload: 'matrix' })}
                        >Matrix</button>
                      </div>
                      {vstate.validationSubView === 'matrix' && activeModel ? (
                        <ValidationMatrix
                          model={activeModel}
                          landsnetReport={landsnetReport}
                          selectedIedName={selectedIedName}
                          onSelectIed={selectIed}
                        />
                      ) : (
                        <IssuesWorkspace
                          issues={vstate.issues}
                          selectedIssueId={vstate.selectedIssueId}
                          filters={vstate.filters}
                          onFilterChange={(next) => vdispatch({ type: 'set-filter', payload: next })}
                          onSelectIssue={(id) => {
                            vdispatch({ type: 'select-issue', payload: id });
                            const issue = vstate.issues.find((i) => i.id === id);
                            const iedName = issue?.entityRef.iedName || issue?.context.iedName;
                            if (iedName) {
                              dispatch({ type: 'set-focus', payload: iedName });
                              dispatch({ type: 'set-selected', payload: { type: 'ied', id: `ied:${iedName}` } });
                            }
                          }}
                          onOpenInGraph={(id) => {
                            const issue = vstate.issues.find((i) => i.id === id);
                            const iedName = issue?.entityRef.iedName || issue?.context.iedName;
                            if (!iedName) return;
                            dispatch({ type: 'set-focus', payload: iedName });
                            dispatch({ type: 'set-selected', payload: { type: 'ied', id: `ied:${iedName}` } });
                            dispatch({ type: 'request-fit' });
                            setAppMode('visualizer');
                          }}
                          onExportJson={() => exportBlob(JSON.stringify(vstate.issues, null, 2), 'validation-report.json', 'application/json')}
                          onExportCsv={() => exportBlob(validationCsv(vstate.issues), 'validation-report.csv', 'text/csv;charset=utf-8;')}
                          onExportLandsnetJson={exportLandsnetJson}
                        />
                      )}
                    </div>
                  ) : null}

                  {/* Compare view */}
                  {appMode === 'compare' ? (
                    <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <CompareBar
                        mode={compareVariant}
                        baselineName={baselineName}
                        newName={newName}
                        onModeChange={setCompareVariant}
                        onLoadBaseline={() => baselineInputRef.current?.click()}
                        onLoadNew={() => newInputRef.current?.click()}
                        showOnlyChanges={showOnlyChanges}
                        onToggleShowOnlyChanges={setShowOnlyChanges}
                      />
                      <section className="panel canvas-panel" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
                        <ChangesPanel
                          changes={compareChanges}
                          selectedIedName={ui.focusIedId}
                          selectedChangeId={selectedChangeId}
                          filters={changeFilters}
                          onFilterChange={(next) => setChangeFilters((prev) => ({ ...prev, ...next }))}
                          onSelectChange={(id) => {
                            setSelectedChangeId(id);
                            const change = diff.changes.find((c) => c.id === id);
                            if (change?.iedName) {
                              dispatch({ type: 'set-focus', payload: change.iedName });
                              dispatch({ type: 'set-selected', payload: { type: 'ied', id: `ied:${change.iedName}` } });
                            }
                          }}
                          onExportJson={() => exportBlob(JSON.stringify(buildDiffReport(diff), null, 2), 'changes-report.json', 'application/json')}
                          onExportCsv={() => exportBlob(changesCsv(diff.changes), 'changes.csv', 'text/csv;charset=utf-8;')}
                        />
                      </section>
                    </div>
                  ) : null}

                  {/* Network view */}
                  {appMode === 'network' ? (
                    <NetworkVisualizerPanel
                      model={activeModel}
                      fileName={fileName}
                      onExportBlob={exportBlob}
                    />
                  ) : null}

                  {/* Statistics view */}
                  {appMode === 'statistics' ? (
                    <StatisticsWorkspace model={activeModel ?? undefined} />
                  ) : null}
                </div>
              )}
              right={<InspectorPanel model={activeModel} baselineModel={appMode === 'compare' ? baselineModel : undefined} selectedEntity={ui.selectedEntity} selectedChange={appMode === 'compare' ? selectedChange : undefined} />}
            />
          </div>
        </div>
      )}

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        model={activeModel}
        onSelectItem={(item) => {
          dispatch({ type: 'set-selected', payload: { type: item.type, id: item.id, label: item.label } });
          if (item.focusIed) {
            dispatch({ type: 'set-focus', payload: item.focusIed });
          }
          dispatch({ type: 'request-fit' });
        }}
      />

      {fileSizeWarning && (
        <div className="file-size-warning-banner" role="alert">
          <span>This file is {fileSizeWarning.mb} MB and may be slow to load.</span>
          <button
            className="btn btn-primary"
            onClick={() => {
              const { file, callback } = fileSizeWarning;
              setFileSizeWarning(null);
              doReadFile(file, callback);
            }}
          >
            Load anyway
          </button>
          <button
            className="btn"
            onClick={() => setFileSizeWarning(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-overlay" role="status" aria-label="Parsing file">
          <div className="loading-card">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Parsing file…</p>
          </div>
        </div>
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
