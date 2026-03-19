import { useEffect, useMemo, useState } from 'react';
import type { SclModel } from '../model/types';
import type { ValidationIssue } from '../validation/types';
import type { AppMode } from '../App';

type Props = {
  model: SclModel | undefined;
  issues: ValidationIssue[];
  fileName: string;
  onNavigate: (mode: AppMode) => void;
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / durationMs));
      const v = Math.round(target * easeOutCubic(t));
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function truncateLabel(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function severityCounts(issues: ValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning' || i.severity === 'warn').length;
  return { errors, warnings };
}

function gaugeArcDash(score: number) {
  const clamped = clamp(score / 100, 0, 1);
  const r = 50;
  const circumference = 2 * Math.PI * r;
  const arcLen = circumference * (270 / 360); // 270deg sweep
  return {
    r,
    circumference,
    arcLen,
    progress: clamped,
  };
}

export default function DashboardWorkspace({ model, issues, fileName, onNavigate }: Props): JSX.Element {
  const { errors, warnings } = useMemo(() => severityCounts(issues), [issues]);

  const health = useMemo(() => {
    let score = 100;
    score -= errors * 3;
    score -= warnings * 1;
    score = clamp(score, 0, 100);
    return score;
  }, [errors, warnings]);

  const healthColor = health >= 90 ? '#22c55e' : health >= 60 ? '#f59e0b' : '#ef4444';

  const iedFinal = model?.ieds.length ?? 0;
  const gooseFinal = model?.gseControls.length ?? 0;
  const svFinal = model?.svControls.length ?? 0;
  const issueFinal = issues.length;

  const iedCount = useCountUp(iedFinal, 900);
  const gooseCount = useCountUp(gooseFinal, 900);
  const svCount = useCountUp(svFinal, 900);
  const issueCount = useCountUp(issueFinal, 900);

  const [gaugeAnimate, setGaugeAnimate] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGaugeAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const gauge = useMemo(() => gaugeArcDash(health), [health]);
  const gaugeDashOffset = gauge.arcLen * (1 - gauge.progress);

  // Donut protocol bandwidth estimates
  const donut = useMemo(() => {
    const gooseMbps = (gooseFinal * 250 * 8 * 10) / 1_000_000;
    const svMbps = (svFinal * 220 * 8 * 4000) / 1_000_000;
    const mmsMbps = ((model?.reportControls.length ?? 0) * 300 * 8 * 2) / 1_000_000;
    const total = gooseMbps + svMbps + mmsMbps;
    return { gooseMbps, svMbps, mmsMbps, total };
  }, [gooseFinal, svFinal, model?.reportControls.length]);

  const [donutAnimate, setDonutAnimate] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDonutAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const donutArcs = useMemo(() => {
    const startDeg = -90;
    const total = donut.total || 0;
    const gooseFrac = total > 0 ? donut.gooseMbps / total : 0;
    const svFrac = total > 0 ? donut.svMbps / total : 0;
    const mmsFrac = total > 0 ? donut.mmsMbps / total : 0;
    const fractions = [
      { key: 'GOOSE', frac: gooseFrac, color: 'var(--goose)', stroke: 'var(--goose)' },
      { key: 'SV', frac: svFrac, color: 'var(--sv)', stroke: 'var(--sv)' },
      { key: 'MMS', frac: mmsFrac, color: 'var(--mms)', stroke: 'var(--mms)' },
    ];

    let cur = startDeg;
    const r = 46;
    const cx = 60;
    const cy = 60;
    return fractions.map((seg, idx) => {
      const angle = seg.frac * 360;
      const next = cur + angle;
      const path = angle <= 0.0001 ? null : describeArc(cx, cy, r, cur, next);
      const arcLen = ((angle / 360) * 2 * Math.PI * r) || 0;
      const out = {
        key: seg.key,
        idx,
        path,
        arcLen,
        start: cur,
        end: next,
        color: seg.stroke,
      };
      cur = next;
      return out;
    });
  }, [donut]);

  // Top 5 busiest IEDs
  const topIeds = useMemo(() => {
    if (!model) return [];
    const gooseOut = new Map<string, number>();
    const svOut = new Map<string, number>();

    for (const g of model.gseControls) gooseOut.set(g.iedName, (gooseOut.get(g.iedName) ?? 0) + 1);
    for (const s of model.svControls) svOut.set(s.iedName, (svOut.get(s.iedName) ?? 0) + 1);

    const edges = model.edges ?? [];
    const gooseIn = new Map<string, number>();
    const svIn = new Map<string, number>();
    for (const e of edges) {
      if (e.signalType === 'GOOSE') gooseIn.set(e.subscriberIed, (gooseIn.get(e.subscriberIed) ?? 0) + 1);
      if (e.signalType === 'SV') svIn.set(e.subscriberIed, (svIn.get(e.subscriberIed) ?? 0) + 1);
    }

    const rows = (model.ieds ?? []).map((ied) => {
      const goOut = gooseOut.get(ied.name) ?? 0;
      const svOutV = svOut.get(ied.name) ?? 0;
      const goIn = gooseIn.get(ied.name) ?? 0;
      const svInV = svIn.get(ied.name) ?? 0;
      return {
        iedName: ied.name,
        gooseOut: goOut,
        svOut: svOutV,
        gooseIn: goIn,
        svIn: svInV,
        total: goOut + svOutV + goIn + svInV,
      };
    });

    return rows
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .filter((r) => r.total > 0 || rows.length <= 5);
  }, [model]);

  const topMax = useMemo(() => {
    return topIeds.reduce((m, r) => Math.max(m, r.total), 0) || 1;
  }, [topIeds]);

  const [barsAnimate, setBarsAnimate] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarsAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const history = useMemo(() => model?.header?.history ?? [], [model?.header?.history]);
  const shownHistory = useMemo(() => {
    const reversed = [...history].reverse();
    return reversed.slice(0, 5);
  }, [history]);
  const earlierRevisions = Math.max(0, history.length - 5);

  if (!model) {
    return (
      <section className="panel dashboard-workspace">
        <p className="hint">Load an SCD file to see dashboard.</p>
      </section>
    );
  }

  return (
    <section className="panel dashboard-workspace">
      <div className="dashboard-inner">
        <div className="dashboard-hero">
          <div className="dashboard-hero-cards">
            <div className="dashboard-hero-card">
              <div className="dashboard-hero-num" style={{ color: 'var(--accent)' }}>
                ◆ {iedCount}
              </div>
              <div className="dashboard-hero-label">IEDs</div>
            </div>
            <div className="dashboard-hero-card">
              <div className="dashboard-hero-num" style={{ color: 'var(--goose)' }}>
                ◈ {gooseCount}
              </div>
              <div className="dashboard-hero-label">GOOSE ctrl</div>
            </div>
            <div className="dashboard-hero-card">
              <div className="dashboard-hero-num" style={{ color: 'var(--sv)' }}>
                ▣ {svCount}
              </div>
              <div className="dashboard-hero-label">SV ctrl</div>
            </div>
            <div className="dashboard-hero-card">
              <div
                className="dashboard-hero-num"
                style={{
                  color: issueFinal > 0 ? '#ef4444' : '#22c55e',
                }}
              >
                ⚠ {issueCount}
              </div>
              <div className="dashboard-hero-label">Issues</div>
            </div>
          </div>

          <div className="dashboard-health">
            <div className="dashboard-health-gauge">
              <svg width="120" height="120" viewBox="0 0 120 120" aria-label="Health score">
                <circle
                  cx="60"
                  cy="60"
                  r={gauge.r}
                  fill="none"
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth="10"
                  strokeDasharray={`${gauge.arcLen} ${gauge.circumference - gauge.arcLen}`}
                  strokeDashoffset="0"
                  transform="rotate(225 60 60)"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={gauge.r}
                  fill="none"
                  stroke={healthColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${gauge.arcLen} ${gauge.circumference - gauge.arcLen}`}
                  strokeDashoffset={gaugeAnimate ? gaugeDashOffset : gauge.arcLen}
                  style={{
                    transition: 'stroke-dashoffset 1200ms ease',
                  }}
                  transform="rotate(225 60 60)"
                />
                <text x="60" y="64" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--text)">
                  {health}
                </text>
                <text x="60" y="85" textAnchor="middle" fontSize="12" fill="var(--muted)">
                  Health
                </text>
              </svg>
            </div>

            <div className="dashboard-health-text">
              <div className="dashboard-health-pill">
                {errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'}
              </div>
              <div className="dashboard-health-file">{fileName}</div>
            </div>
          </div>
        </div>

        <div className="dashboard-grid-2">
          <div className="dashboard-section">
            <div className="dashboard-section-title">Protocol bandwidth</div>
            <div className="dashboard-bandwidth-row">
              <svg width="120" height="120" viewBox="0 0 120 120" aria-label="Estimated Mbps donut">
                <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="18" />

                {donutArcs.map((seg) => {
                  if (!seg.path) return null;
                  return (
                    <path
                      key={seg.key}
                      d={seg.path}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="18"
                      strokeLinecap="round"
                      strokeDasharray={`${seg.arcLen}`}
                      strokeDashoffset={donutAnimate ? 0 : seg.arcLen}
                      style={{
                        transition: 'stroke-dashoffset 800ms ease',
                        transitionDelay: `${seg.idx * 200}ms`,
                      }}
                    />
                  );
                })}

                <text x="60" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">
                  {donut.total.toFixed(0)}
                </text>
                <text x="60" y="82" textAnchor="middle" fontSize="12" fill="var(--muted)">
                  Mbps total
                </text>
              </svg>

              <div className="dashboard-bandwidth-legend">
                <div className="dashboard-legend-row">
                  <span className="dashboard-legend-dot" style={{ background: 'var(--goose)' }} />
                  <span className="dashboard-legend-label">GOOSE</span>
                  <span className="dashboard-legend-value">{donut.gooseMbps.toFixed(1)}</span>
                </div>
                <div className="dashboard-legend-row">
                  <span className="dashboard-legend-dot" style={{ background: 'var(--sv)' }} />
                  <span className="dashboard-legend-label">SV</span>
                  <span className="dashboard-legend-value">{donut.svMbps.toFixed(1)}</span>
                </div>
                <div className="dashboard-legend-row">
                  <span className="dashboard-legend-dot" style={{ background: 'var(--mms)' }} />
                  <span className="dashboard-legend-label">MMS</span>
                  <span className="dashboard-legend-value">{donut.mmsMbps.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-section">
            <div className="dashboard-section-title">Top 5 busiest IEDs</div>
            <div className="dashboard-busiest-list">
              {topIeds.length === 0 ? <p className="hint">No traffic data.</p> : null}
              {topIeds.map((row, idx) => {
                const w = 210;
                const gooseW = (row.gooseOut / topMax) * w;
                const svW = (row.svOut / topMax) * w;
                const subW = ((row.gooseIn + row.svIn) / topMax) * w;
                return (
                  <div key={row.iedName} className="dashboard-busiest-row">
                    <div className="dashboard-busiest-label" title={row.iedName}>
                      {truncateLabel(row.iedName, 18)}
                    </div>
                    <svg className="dashboard-busiest-bar" viewBox="0 0 210 16" preserveAspectRatio="none">
                      <g
                        className={`dashboard-traffic-bar-group ${barsAnimate ? 'dashboard-traffic-bar-animate' : ''}`}
                        style={{ transitionDelay: `${idx * 80}ms` }}
                      >
                        <rect x="0" y="2" width={gooseW} height="12" rx="3" fill="var(--goose)" opacity={0.95} />
                        <rect x={gooseW} y="2" width={svW} height="12" rx="3" fill="var(--sv)" opacity={0.95} />
                        <rect
                          x={gooseW + svW}
                          y="2"
                          width={subW}
                          height="12"
                          rx="3"
                          fill="#64748b"
                          opacity={0.9}
                        />
                      </g>
                    </svg>
                    <div className="dashboard-busiest-value">{row.total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="dashboard-grid-2 dashboard-grid-2-bottom">
          <div className="dashboard-section">
            <div className="dashboard-section-title">SCD revision history</div>
            {shownHistory.length === 0 ? <p className="hint">No revision history in this file.</p> : null}
            <div className="dashboard-timeline">
              {shownHistory.map((h, idx) => {
                const isLatest = idx === 0;
                const dotClass = isLatest ? 'dashboard-timeline-dot dashboard-timeline-dot-latest' : 'dashboard-timeline-dot';
                return (
                  <div key={`${h.version ?? 'v'}:${h.revision ?? 'r'}:${idx}`} className="dashboard-timeline-row">
                    <span className={dotClass} />
                    <span className={`dashboard-timeline-badge ${isLatest ? 'dashboard-timeline-badge-latest' : ''}`}>
                      v{h.version ?? '-'} R{h.revision ?? '-'}
                    </span>
                    <span className="dashboard-timeline-what">{h.what ?? '-'}</span>
                    <span className="dashboard-timeline-when">
                      {h.when ?? '-'} — {h.who ?? '-'}
                    </span>
                  </div>
                );
              })}
              {earlierRevisions > 0 ? (
                <div className="dashboard-timeline-hint">… and {earlierRevisions} earlier revisions</div>
              ) : null}
            </div>
          </div>

          <div className="dashboard-section dashboard-section-spacer" />
        </div>

        <div className="dashboard-quick-actions">
          <button className="btn btn-primary" type="button" onClick={() => onNavigate('visualizer')}>
            View Graph →
          </button>
          <button className="btn" type="button" onClick={() => onNavigate('issues')}>
            View Issues →
          </button>
          <button className="btn" type="button" onClick={() => onNavigate('statistics')}>
            View Statistics →
          </button>
        </div>
      </div>
    </section>
  );
}

