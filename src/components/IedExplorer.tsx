import { useMemo, useState } from 'react';
import type {
  SclModel, IedModel, LDeviceModel, LnModel, DataSetModel,
  GooseControlModel, SvControlModel, ReportControlModel, FcdaModel,
  DataTypeTemplatesModel,
} from '../model/types';

interface IedExplorerProps {
  model: SclModel;
}

export default function IedExplorer({ model }: IedExplorerProps): JSX.Element {
  const [selectedIed, setSelectedIed] = useState<string>(() => model.ieds[0]?.name ?? '');
  const [query, setQuery] = useState('');

  const filteredIeds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.ieds
      .filter((ied) => !q || ied.name.toLowerCase().includes(q) || ied.desc?.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [model.ieds, query]);

  const ied = useMemo(() => model.ieds.find((i) => i.name === selectedIed) ?? null, [model.ieds, selectedIed]);

  return (
    <div className="ied-explorer">
      {/* Left: IED list */}
      <div className="ied-explorer-list">
        <div className="ied-explorer-search">
          <input
            className="input"
            placeholder="Filter IEDs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="hint">{filteredIeds.length} IEDs</span>
        </div>
        <div className="ied-explorer-list-scroll">
          {filteredIeds.map((i) => (
            <button
              key={i.name}
              className={`ied-list-item ${selectedIed === i.name ? 'ied-list-item-active' : ''}`}
              onClick={() => setSelectedIed(i.name)}
            >
              <span className="ied-list-icon">⬡</span>
              <span className="ied-list-name">{i.name}</span>
              {i.desc && <span className="ied-list-desc">{i.desc}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Right: tree */}
      <div className="ied-explorer-tree-pane">
        {ied ? (
          <IedTree ied={ied} model={model} />
        ) : (
          <div style={{ padding: 24 }}><p className="hint">Select an IED to explore.</p></div>
        )}
      </div>
    </div>
  );
}

/* ── IED Tree ──────────────────────────────────────────────────────── */

function IedTree({ ied, model }: { ied: IedModel; model: SclModel }): JSX.Element {
  // Build lookup maps for this IED
  const datasets = useMemo(
    () => model.dataSets.filter((d) => d.iedName === ied.name),
    [model.dataSets, ied.name],
  );
  const goose = useMemo(
    () => model.gseControls.filter((g) => g.iedName === ied.name),
    [model.gseControls, ied.name],
  );
  const sv = useMemo(
    () => model.svControls.filter((s) => s.iedName === ied.name),
    [model.svControls, ied.name],
  );
  const reports = useMemo(
    () => model.reportControls.filter((r) => r.iedName === ied.name),
    [model.reportControls, ied.name],
  );

  // Expand state: set of node keys that are open
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    s.add(`ied:${ied.name}`);
    ied.lDevices.forEach((ld) => s.add(`ld:${ied.name}:${ld.inst}`));
    return s;
  });

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isOpen = (key: string) => expanded.has(key);

  return (
    <div className="ied-tree">
      {/* IED header */}
      <TreeNode
        nodeKey={`ied:${ied.name}`}
        icon="⬡"
        iconClass="ied-tree-icon-ied"
        label={ied.name}
        sublabel={ied.desc}
        isOpen={isOpen(`ied:${ied.name}`)}
        onToggle={toggle}
        depth={0}
      >
        {ied.lDevices.map((ld) => (
          <LDeviceNode
            key={ld.inst}
            ied={ied}
            ld={ld}
            datasets={datasets.filter((d) => d.ldInst === ld.inst)}
            goose={goose.filter((g) => g.ldInst === ld.inst)}
            sv={sv.filter((s) => s.ldInst === ld.inst)}
            reports={reports.filter((r) => r.ldInst === ld.inst)}
            dtt={model.dataTypeTemplates ?? { lNodeTypes: new Map(), doTypes: new Map(), daTypes: new Map(), enumTypes: new Map(), duplicateTypeIds: [] }}
            isOpen={isOpen}
            onToggle={toggle}
            depth={1}
          />
        ))}
      </TreeNode>
    </div>
  );
}

/* ── LDevice node ──────────────────────────────────────────────────── */

function LDeviceNode({
  ied, ld, datasets, goose, sv, reports, dtt, isOpen, onToggle, depth,
}: {
  ied: IedModel;
  ld: LDeviceModel;
  datasets: DataSetModel[];
  goose: GooseControlModel[];
  sv: SvControlModel[];
  reports: ReportControlModel[];
  dtt: DataTypeTemplatesModel;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  depth: number;
}): JSX.Element {
  const ldKey = `ld:${ied.name}:${ld.inst}`;
  const ln0Key = `ln0:${ied.name}:${ld.inst}`;

  return (
    <TreeNode
      nodeKey={ldKey}
      icon="🗂"
      iconClass="ied-tree-icon-ld"
      label={ld.inst}
      sublabel="LDevice"
      isOpen={isOpen(ldKey)}
      onToggle={onToggle}
      depth={depth}
    >
      {/* LN0 */}
      <TreeNode
        nodeKey={ln0Key}
        icon="⚙"
        iconClass="ied-tree-icon-ln0"
        label="LLN0"
        sublabel="Logical Node Zero"
        isOpen={isOpen(ln0Key)}
        onToggle={onToggle}
        depth={depth + 1}
      >
        {/* DataSets */}
        {datasets.length > 0 && (
          <GroupNode
            groupKey={`ds:${ied.name}:${ld.inst}`}
            icon="📋"
            iconClass="ied-tree-icon-ds"
            label="DataSets"
            count={datasets.length}
            isOpen={isOpen}
            onToggle={onToggle}
            depth={depth + 2}
          >
            {datasets.map((ds) => (
              <DataSetNode key={ds.key} ds={ds} isOpen={isOpen} onToggle={onToggle} iedName={ied.name} depth={depth + 3} />
            ))}
          </GroupNode>
        )}

        {/* GOOSE */}
        {goose.length > 0 && (
          <GroupNode
            groupKey={`goose:${ied.name}:${ld.inst}`}
            icon="📡"
            iconClass="ied-tree-icon-goose"
            label="GOOSE"
            count={goose.length}
            isOpen={isOpen}
            onToggle={onToggle}
            depth={depth + 2}
          >
            {goose.map((g) => (
              <LeafNode
                key={g.key}
                icon="📡"
                iconClass="ied-tree-icon-goose"
                label={g.name}
                sublabel={g.datSet ? `→ ${g.datSet}` : undefined}
                tag={g.appId ? `APPID ${g.appId}` : undefined}
                depth={depth + 3}
              />
            ))}
          </GroupNode>
        )}

        {/* SV */}
        {sv.length > 0 && (
          <GroupNode
            groupKey={`sv:${ied.name}:${ld.inst}`}
            icon="〰"
            iconClass="ied-tree-icon-sv"
            label="Sampled Values"
            count={sv.length}
            isOpen={isOpen}
            onToggle={onToggle}
            depth={depth + 2}
          >
            {sv.map((s) => (
              <LeafNode
                key={s.key}
                icon="〰"
                iconClass="ied-tree-icon-sv"
                label={s.name}
                sublabel={s.datSet ? `→ ${s.datSet}` : undefined}
                tag={s.smpRate ? `${s.smpRate} smp/s` : undefined}
                depth={depth + 3}
              />
            ))}
          </GroupNode>
        )}

        {/* Reports */}
        {reports.length > 0 && (
          <GroupNode
            groupKey={`rpt:${ied.name}:${ld.inst}`}
            icon="📊"
            iconClass="ied-tree-icon-rpt"
            label="Reports"
            count={reports.length}
            isOpen={isOpen}
            onToggle={onToggle}
            depth={depth + 2}
          >
            {reports.map((r) => (
              <LeafNode
                key={r.key}
                icon="📊"
                iconClass="ied-tree-icon-rpt"
                label={r.name}
                sublabel={r.datSet ? `→ ${r.datSet}` : undefined}
                tag={r.buffered ? 'Buffered' : 'Unbuffered'}
                depth={depth + 3}
              />
            ))}
          </GroupNode>
        )}
      </TreeNode>

      {/* Other LNs */}
      {ld.lns.map((ln) => (
        <LnNode
          key={`${ln.lnClass}${ln.inst}`}
          nodeKey={`ln:${ied.name}:${ld.inst}:${ln.prefix ?? ''}${ln.lnClass}${ln.inst}`}
          ln={ln}
          dtt={dtt}
          isOpen={isOpen}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </TreeNode>
  );
}

/* ── LN node (with DO/DA from DataTypeTemplates) ─────────────────── */

function LnNode({
  nodeKey, ln, dtt, isOpen, onToggle, depth,
}: {
  nodeKey: string;
  ln: LnModel;
  dtt: DataTypeTemplatesModel;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  depth: number;
}): JSX.Element {
  const label = `${ln.prefix ?? ''}${ln.lnClass}${ln.inst}`;
  const lnTypeDef = ln.lnType ? dtt.lNodeTypes.get(ln.lnType) : undefined;
  const dos = lnTypeDef?.dos ?? [];

  if (dos.length === 0) {
    return (
      <LeafNode
        icon="◈"
        iconClass={`ied-tree-icon-ln ied-tree-ln-${getLnGroup(ln.lnClass)}`}
        label={label}
        sublabel={ln.lnType}
        depth={depth}
      />
    );
  }

  return (
    <TreeNode
      nodeKey={nodeKey}
      icon="◈"
      iconClass={`ied-tree-icon-ln ied-tree-ln-${getLnGroup(ln.lnClass)}`}
      label={label}
      sublabel={ln.lnType}
      isOpen={isOpen(nodeKey)}
      onToggle={onToggle}
      depth={depth}
    >
      {dos.map((doEntry) => (
        <DoNode
          key={doEntry.name}
          nodeKey={`${nodeKey}:do:${doEntry.name}`}
          doName={doEntry.name}
          doType={doEntry.type}
          dtt={dtt}
          isOpen={isOpen}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </TreeNode>
  );
}

/* ── DO node ──────────────────────────────────────────────────────── */

function DoNode({
  nodeKey, doName, doType, dtt, isOpen, onToggle, depth,
}: {
  nodeKey: string;
  doName: string;
  doType: string;
  dtt: DataTypeTemplatesModel;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  depth: number;
}): JSX.Element {
  const doTypeDef = dtt.doTypes.get(doType);
  const das = doTypeDef?.das ?? [];
  const cdc = doTypeDef?.cdc;

  if (das.length === 0) {
    return (
      <LeafNode
        icon="◇"
        iconClass="ied-tree-icon-do"
        label={doName}
        sublabel={cdc}
        depth={depth}
      />
    );
  }

  return (
    <TreeNode
      nodeKey={nodeKey}
      icon="◇"
      iconClass="ied-tree-icon-do"
      label={doName}
      sublabel={cdc}
      isOpen={isOpen(nodeKey)}
      onToggle={onToggle}
      depth={depth}
    >
      {das.map((da) => (
        <LeafNode
          key={da.name}
          icon="·"
          iconClass="ied-tree-icon-da"
          label={da.name}
          sublabel={da.bType ?? da.type}
          tag={da.fc}
          depth={depth + 1}
        />
      ))}
    </TreeNode>
  );
}

/* ── DataSet node ─────────────────────────────────────────────────── */

function DataSetNode({
  ds, isOpen, onToggle, iedName, depth,
}: {
  ds: DataSetModel;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  iedName: string;
  depth: number;
}): JSX.Element {
  const key = `dsnode:${iedName}:${ds.key}`;
  return (
    <TreeNode
      nodeKey={key}
      icon="📋"
      iconClass="ied-tree-icon-ds"
      label={ds.name}
      sublabel={`${ds.fcdas.length} FCDA${ds.fcdas.length !== 1 ? 's' : ''}`}
      isOpen={isOpen(key)}
      onToggle={onToggle}
      depth={depth}
    >
      {ds.fcdas.map((fcda, i) => (
        <LeafNode
          key={i}
          icon="·"
          iconClass="ied-tree-icon-fcda"
          label={fcdaLabel(fcda)}
          sublabel={fcda.fc ? `[${fcda.fc}]` : undefined}
          depth={depth + 1}
        />
      ))}
    </TreeNode>
  );
}

/* ── Reusable tree primitives ─────────────────────────────────────── */

function TreeNode({
  nodeKey, icon, iconClass, label, sublabel, isOpen, onToggle, depth, children,
}: {
  nodeKey: string;
  icon: string;
  iconClass: string;
  label: string;
  sublabel?: string;
  isOpen: boolean;
  onToggle: (key: string) => void;
  depth: number;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="ied-tree-node">
      <button
        className={`ied-tree-row ${isOpen ? 'ied-tree-row-open' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => onToggle(nodeKey)}
      >
        <span className="ied-tree-chevron">{isOpen ? '▾' : '▸'}</span>
        <span className={`ied-tree-node-icon ${iconClass}`}>{icon}</span>
        <span className="ied-tree-label">{label}</span>
        {sublabel && <span className="ied-tree-sublabel">{sublabel}</span>}
      </button>
      {isOpen && <div className="ied-tree-children">{children}</div>}
    </div>
  );
}

function GroupNode({
  groupKey, icon, iconClass, label, count, isOpen, onToggle, depth, children,
}: {
  groupKey: string;
  icon: string;
  iconClass: string;
  label: string;
  count: number;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  depth: number;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <TreeNode
      nodeKey={groupKey}
      icon={icon}
      iconClass={iconClass}
      label={label}
      sublabel={`${count}`}
      isOpen={isOpen(groupKey)}
      onToggle={onToggle}
      depth={depth}
    >
      {children}
    </TreeNode>
  );
}

function LeafNode({
  icon, iconClass, label, sublabel, tag, depth,
}: {
  icon: string;
  iconClass: string;
  label: string;
  sublabel?: string;
  tag?: string;
  depth: number;
}): JSX.Element {
  return (
    <div
      className="ied-tree-row ied-tree-leaf"
      style={{ paddingLeft: depth * 16 + 4 }}
    >
      <span className="ied-tree-chevron ied-tree-chevron-leaf"> </span>
      <span className={`ied-tree-node-icon ${iconClass}`}>{icon}</span>
      <span className="ied-tree-label">{label}</span>
      {sublabel && <span className="ied-tree-sublabel">{sublabel}</span>}
      {tag && <span className="ied-tree-tag">{tag}</span>}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function fcdaLabel(fcda: FcdaModel): string {
  const ln = `${fcda.prefix ?? ''}${fcda.lnClass ?? ''}${fcda.lnInst ?? ''}`;
  const do_ = fcda.doName ?? '';
  const da = fcda.daName ? `.${fcda.daName}` : '';
  return `${fcda.ldInst ?? ''}/  ${ln}.${do_}${da}`;
}

function getLnGroup(lnClass: string): string {
  if (lnClass === 'LPHD') return 'phd';
  const first = lnClass[0];
  if (first === 'P') return 'prot';
  if (first === 'C') return 'ctrl';
  if (first === 'M') return 'meas';
  if (first === 'X') return 'sw';
  if (first === 'S') return 'sens';
  if (first === 'G') return 'gen';
  if (first === 'A') return 'auto';
  if (first === 'T') return 'inst';
  return 'other';
}
