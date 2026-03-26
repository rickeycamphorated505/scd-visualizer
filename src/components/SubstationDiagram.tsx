import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SclModel } from '../model/types';
import type { EquipmentKind } from '../sld/types';
import {
  computeLayout,
  BAY_WIDTH,
  IED_CHIP_HEIGHT,
  IED_CHIP_GAP,
  LEFT_MARGIN,
  SYMBOL_HEIGHT,
  SYMBOL_SIZE,
  VL_HEADER_HEIGHT,
} from '../sld/layout';
import type { LayoutVoltageLevel, LayoutBay, LayoutEquipment } from '../sld/layout';
import { getSymbol } from '../sld/symbols';

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function SubstationDiagram({ model }: { model: SclModel | null }) {
  const sld = model?.sld;

  const [transform, setTransform] = useState<Transform>({ x: 40, y: 40, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [hiddenVls, setHiddenVls] = useState<Set<string>>(new Set());
  const panStart = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = useMemo(
    () => (sld ? computeLayout(sld.voltageLevels) : []),
    [sld],
  );

  const toggleVl = useCallback((name: string) => {
    setHiddenVls((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Total content size — used for pan bounds
  const contentSize = useMemo(() => {
    if (layout.length === 0) return { w: 800, h: 600 };
    const last = layout[layout.length - 1];
    return {
      w: Math.max(...layout.map((l) => l.busWidth)),
      h: last.yOffset + last.totalHeight,
    };
  }, [layout]);
  const contentSizeRef = useRef(contentSize);
  contentSizeRef.current = contentSize;

  // Clamp transform so at least 200px of content stays on-screen
  const clampT = useCallback((t: Transform): Transform => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return t;
    const { w, h } = contentSizeRef.current;
    const margin = 200;
    const x = Math.max(-w * t.scale + margin, Math.min(rect.width - margin, t.x));
    const y = Math.max(-h * t.scale + margin, Math.min(rect.height - margin, t.y));
    return { ...t, x, y };
  }, []);

  // Use native non-passive wheel listener so preventDefault() actually works
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform((t) => {
        const scale = Math.max(0.08, Math.min(10, t.scale * factor));
        const next = {
          scale,
          x: mx - (mx - t.x) * (scale / t.scale),
          y: my - (my - t.y) * (scale / t.scale),
        };
        return clampT(next);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampT]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y };
    },
    [transform],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!panning || !panStart.current) return;
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setTransform((t) => clampT({ ...t, x: panStart.current!.tx + dx, y: panStart.current!.ty + dy }));
    },
    [panning, clampT],
  );

  const handleMouseUp = useCallback(() => {
    setPanning(false);
    panStart.current = null;
  }, []);

  const fitToScreen = useCallback(() => {
    if (!svgRef.current || layout.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const visible = layout.filter((vl) => !hiddenVls.has(vl.name));
    if (visible.length === 0) return;
    const last = visible[visible.length - 1];
    const totalH = last.yOffset + last.totalHeight;
    const totalW = Math.max(...visible.map((l) => l.busWidth));
    const scale = Math.min(
      (rect.width - 80) / totalW,
      (rect.height - 80) / totalH,
      2,
    );
    setTransform({ x: 40, y: 40, scale: Math.max(0.1, scale) });
  }, [layout, hiddenVls]);

  // Auto-fit when layout first loads
  useEffect(() => {
    if (layout.length > 0) {
      setTimeout(fitToScreen, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  if (!sld) {
    return (
      <div
        className="sld-root"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: 14,
          fontFamily: 'monospace',
        }}
      >
        No &lt;Substation&gt; section found in this file.
      </div>
    );
  }

  return (
    <div className="sld-root">
      {/* Toolbar */}
      <div className="sld-toolbar">
        <button
          className="btn"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.25, 10) }))}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="btn"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(t.scale * 0.8, 0.08) }))}
          title="Zoom out"
        >
          −
        </button>
        <button className="btn" onClick={() => setTransform({ x: 40, y: 40, scale: 1 })} title="Reset zoom">
          ⌂
        </button>
        <button className="btn" onClick={fitToScreen} title="Fit to screen (or double-click canvas)">
          Fit
        </button>
        <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace', marginLeft: 8 }}>
          {sld.substationName}
        </span>

        {/* Voltage level filter pills */}
        <div className="sld-vl-filter">
          {sld.voltageLevels.map((vl) => (
            <button
              key={vl.name}
              className={`sld-vl-pill${hiddenVls.has(vl.name) ? '' : ' active'}`}
              style={{ color: vl.color, borderColor: vl.color }}
              onClick={() => toggleVl(vl.name)}
            >
              {vl.nominalVoltage > 0 ? `${Math.round(vl.nominalVoltage)} kV` : vl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`sld-canvas-wrap${panning ? ' panning' : ''}`}
        onDoubleClick={fitToScreen}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg ref={svgRef} width="100%" height="100%">
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {layout
              .filter((vl) => !hiddenVls.has(vl.name))
              .map((vl) => (
                <SldVoltageSection key={vl.name} vl={vl} />
              ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─── Voltage level section ───────────────────────────────────────────────────

function SldVoltageSection({ vl }: { vl: LayoutVoltageLevel }) {
  return (
    <g>
      {/* Voltage level label (left of busbars) */}
      <text
        x={LEFT_MARGIN - 10}
        y={vl.busYTop + (vl.busYBot - vl.busYTop) / 2 + 5}
        fill={vl.color}
        className="sld-vl-label"
        textAnchor="end"
      >
        {vl.nominalVoltage > 0 ? `${Math.round(vl.nominalVoltage)} kV` : vl.name}
      </text>

      {/* Top busbar (Bus A) */}
      <line
        x1={LEFT_MARGIN}
        y1={vl.busYTop}
        x2={vl.busWidth}
        y2={vl.busYTop}
        stroke={vl.color}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Bottom busbar (Bus B) */}
      <line
        x1={LEFT_MARGIN}
        y1={vl.busYBot}
        x2={vl.busWidth}
        y2={vl.busYBot}
        stroke={vl.color}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Busbar labels */}
      <text x={LEFT_MARGIN - 10} y={vl.busYTop + 4} fill={vl.color} fontSize="9" fontFamily="monospace" textAnchor="end" opacity="0.6">A</text>
      <text x={LEFT_MARGIN - 10} y={vl.busYBot + 4} fill={vl.color} fontSize="9" fontFamily="monospace" textAnchor="end" opacity="0.6">B</text>

      {/* Bay columns */}
      {vl.bays.map((bay) => (
        <SldBayColumn key={bay.name} bay={bay} vl={vl} />
      ))}
    </g>
  );
}

// ─── Bay column ──────────────────────────────────────────────────────────────

function SldBayColumn({ bay, vl }: { bay: LayoutBay; vl: LayoutVoltageLevel }) {
  // Vertical feeder line from top busbar through to last equipment
  const lastEq = bay.equipment[bay.equipment.length - 1];
  const feederBottom = lastEq ? lastEq.y + SYMBOL_HEIGHT / 2 : vl.busYBot + 20;

  return (
    <g>
      {/* Bay label */}
      <text
        x={bay.x}
        y={vl.busYTop - 14}
        fill="#64748b"
        className="sld-bay-label"
        textAnchor="middle"
      >
        {bay.name}
      </text>

      {/* Vertical feeder stub — bus A to bus B */}
      <line
        x1={bay.x} y1={vl.busYTop}
        x2={bay.x} y2={vl.busYBot}
        stroke={vl.color} strokeWidth="1.5" opacity="0.35"
      />

      {/* Vertical feeder below bus B to last equipment */}
      {bay.equipment.length > 0 && (
        <line
          x1={bay.x} y1={vl.busYBot}
          x2={bay.x} y2={feederBottom}
          stroke={vl.color} strokeWidth="1.5" opacity="0.25"
        />
      )}

      {/* Equipment symbols */}
      {bay.equipment.map((eq) => (
        <SldEquipmentItem key={eq.name} eq={eq} color={vl.color} />
      ))}
    </g>
  );
}

// ─── Equipment item ───────────────────────────────────────────────────────────

function SldEquipmentItem({ eq, color }: { eq: LayoutEquipment; color: string }) {
  const Sym = getSymbol(eq.kind as EquipmentKind);
  const symW = SYMBOL_SIZE;
  const symH = SYMBOL_HEIGHT;

  return (
    <g>
      {/* Symbol centred on (eq.x, eq.y) */}
      <g transform={`translate(${eq.x - symW / 2}, ${eq.y - symH / 2})`}>
        <Sym color={color} size={symH} />
      </g>

      {/* Equipment name (right of symbol) */}
      <text
        x={eq.x + symW / 2 + 5}
        y={eq.y + 4}
        fill="#94a3b8"
        fontSize="9"
        fontFamily="monospace"
      >
        {eq.name}
      </text>

      {/* IED chips */}
      {eq.ieds.map((ied, i) => (
        <g
          key={ied}
          className="sld-ied-chip"
          transform={`translate(${eq.x - 40}, ${eq.chipStartY + i * (IED_CHIP_HEIGHT + IED_CHIP_GAP)})`}
        >
          <rect
            rx="3"
            width="80"
            height={IED_CHIP_HEIGHT}
            fill="#1e293b"
            stroke={color}
            strokeWidth="1"
          />
          <text
            x="40"
            y={IED_CHIP_HEIGHT / 2}
            fill={color}
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {ied}
          </text>
        </g>
      ))}
    </g>
  );
}
