import React from 'react';
import type { EquipmentKind } from './types';

export interface SymbolProps {
  color: string;
  size?: number;
}

const BASE_W = 60;
const BASE_H = 100;

/** Shared blade + pivot geometry used by DIS and CBR.
 *  Pivot at (30,36), blade open at -30° from vertical, length 22px.
 *  Conductor top (30,0)→(30,35) and bottom (30,65)→(30,100).
 */
function BladePivot({ color }: { color: string }) {
  const rad = (-30 * Math.PI) / 180;
  const bx = 30 + 22 * Math.sin(rad);
  const by = 36 + 22 * Math.cos(rad);
  return (
    <>
      <line x1="30" y1="0" x2="30" y2="35" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="36" r="3" fill={color} />
      <line
        x1="30" y1="36"
        x2={bx.toFixed(2)} y2={by.toFixed(2)}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      <line x1="30" y1="65" x2="30" y2="100" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/** DIS — Disconnector (IEC 60617 ref 7-2-01)
 *  Blade + pivot dot. NO star/circle at the fixed-contact end.
 */
export function DisSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <BladePivot color={color} />
    </svg>
  );
}

/** CBR — Circuit Breaker (IEC 60617 ref 7-2-04)
 *  Identical to DIS plus a 6-point star (✱) at the fixed-contact end.
 *  Star center at (21, 68) — where blade tip rests when open.
 *  Star: 3 lines at 0°/60°/120° through centre, radius 6px.
 */
export function CbrSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  const cx = 21;
  const cy = 68;
  const r = 6;
  const starLines = [0, 60, 120].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return {
      x1: cx - r * Math.sin(a),
      y1: cy - r * Math.cos(a),
      x2: cx + r * Math.sin(a),
      y2: cy + r * Math.cos(a),
    };
  });
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <BladePivot color={color} />
      {starLines.map((l, i) => (
        <line
          key={i}
          x1={l.x1.toFixed(2)} y1={l.y1.toFixed(2)}
          x2={l.x2.toFixed(2)} y2={l.y2.toFixed(2)}
          stroke={color} strokeWidth="1.8" strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** GG — Earthing Switch (IEC 60617 ref 7-2-03)
 *  Pivot at (30,31), blade swings at -45° toward earth symbol below.
 *  Earth symbol centred at (30,65): three bars of decreasing width.
 *  No bottom terminal; top conductor (30,0)→(30,30).
 */
export function GgSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  const rad = (-45 * Math.PI) / 180;
  const bx = 30 + 22 * Math.sin(rad);
  const by = 31 + 22 * Math.cos(rad);
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <line x1="30" y1="0" x2="30" y2="30" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="31" r="3" fill={color} />
      <line
        x1="30" y1="31"
        x2={bx.toFixed(2)} y2={by.toFixed(2)}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      {/* Earth symbol */}
      <line x1="10" y1="65" x2="50" y2="65" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="72" x2="44" y2="72" stroke={color} strokeWidth="2"   strokeLinecap="round" />
      <line x1="22" y1="79" x2="38" y2="79" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** CTR — Current Transformer (IEC 60617 ref 7-5-01)
 *  Vertical conductor through a circle; two horizontal winding marks inside.
 */
export function CtrSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <line x1="30" y1="0" x2="30" y2="100" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="50" r="12" stroke={color} strokeWidth="2" fill="none" />
      <line x1="23" y1="45" x2="37" y2="45" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="55" x2="37" y2="55" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** VTR — Voltage Transformer (IEC 60617 ref 7-5-02)
 *  Vertical conductor with two overlapping circles (representing windings).
 */
export function VtrSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <line x1="30" y1="0" x2="30" y2="100" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="44" r="10" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="30" cy="56" r="10" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  );
}

/** IFL — Line / Feeder termination: vertical conductor + diagonal at bottom-right */
export function IflSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <line x1="30" y1="0"  x2="30" y2="80" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="80" x2="52" y2="100" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** GV — Series Capacitor / General Equipment: conductor + small box */
export function GvSymbol({ color, size = BASE_H }: SymbolProps) {
  const scale = size / BASE_H;
  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      overflow="visible"
    >
      <line x1="30" y1="0"  x2="30" y2="38" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <rect x="18" y="38" width="24" height="24" stroke={color} strokeWidth="2" fill="none" />
      <line x1="30" y1="62" x2="30" y2="100" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SYMBOL_MAP: Partial<Record<EquipmentKind, React.FC<SymbolProps>>> = {
  CBR: CbrSymbol,
  DIS: DisSymbol,
  GG:  GgSymbol,
  CTR: CtrSymbol,
  VTR: VtrSymbol,
  IFL: IflSymbol,
  GV:  GvSymbol,
};

export function getSymbol(kind: EquipmentKind): React.FC<SymbolProps> {
  return SYMBOL_MAP[kind] ?? IflSymbol;
}
