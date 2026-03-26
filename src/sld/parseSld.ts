import type { SldModel, SldVoltageLevel, SldBay, SldEquipment, EquipmentKind } from './types';

const SCL_NS = 'http://www.iec.ch/61850/2003/SCL';

const CONDUCTING_EQUIPMENT_TYPES: Record<string, EquipmentKind> = {
  CBR: 'CBR',
  DIS: 'DIS',
  GG: 'GG',
  CTR: 'CTR',
  VTR: 'VTR',
  IFL: 'IFL',
  GV: 'GV',
  BAY: 'BAY',
  BUS: 'BUS',
};

const VOLTAGE_COLORS: Array<[number, string]> = [
  [200, '#4ade80'],  // ≥220 kV → green
  [100, '#f87171'],  // ≥132 kV → red
  [10,  '#fbbf24'],  // ≥11 kV  → yellow
  [0,   '#94a3b8'],  // fallback → slate
];

function voltageColor(kv: number): string {
  for (const [threshold, color] of VOLTAGE_COLORS) {
    if (kv >= threshold) return color;
  }
  return '#94a3b8';
}

function getEls(parent: Element, tag: string): Element[] {
  const nsEls = Array.from(parent.getElementsByTagNameNS(SCL_NS, tag));
  return nsEls.length > 0 ? nsEls : Array.from(parent.getElementsByTagName(tag));
}

export function parseSld(doc: Document): SldModel | null {
  const substationEl =
    doc.getElementsByTagNameNS(SCL_NS, 'Substation')[0] ??
    doc.getElementsByTagName('Substation')[0];
  if (!substationEl) return null;

  const substationName = substationEl.getAttribute('name') ?? 'Substation';
  const voltageLevels: SldVoltageLevel[] = [];

  for (const vlEl of getEls(substationEl, 'VoltageLevel')) {
    const vlName = vlEl.getAttribute('name') ?? '';

    // Voltage: <Voltage multiplier="k" unit="V">220</Voltage> → 220 kV (multiplier k means value is already kV)
    // If multiplier is absent/empty, value is in V → divide by 1000
    let nominalVoltage = 0;
    const voltEl = vlEl.getElementsByTagName('Voltage')[0];
    if (voltEl?.textContent) {
      const multiplier = voltEl.getAttribute('multiplier') ?? '';
      const raw = parseFloat(voltEl.textContent);
      nominalVoltage = multiplier === 'k' ? raw : raw / 1000;
    }
    const voltAttr = vlEl.getAttribute('volt');
    if (voltAttr && nominalVoltage === 0) {
      nominalVoltage = parseFloat(voltAttr) / 1000;
    }

    const color = voltageColor(nominalVoltage);
    const bays: SldBay[] = [];
    let col = 0;

    for (const bayEl of getEls(vlEl, 'Bay')) {
      const bayName = bayEl.getAttribute('name') ?? '';
      const bayDesc = bayEl.getAttribute('desc') ?? undefined;
      const equipment: SldEquipment[] = [];

      // SCL uses <ConductingEquipment type="CBR|DIS|GG|...">
      for (const eqEl of getEls(bayEl, 'ConductingEquipment')) {
        const typeAttr = eqEl.getAttribute('type') ?? '';
        const kind: EquipmentKind = CONDUCTING_EQUIPMENT_TYPES[typeAttr] ?? 'IFL';
        const eqName = eqEl.getAttribute('name') ?? '';
        const eqDesc = eqEl.getAttribute('desc') ?? undefined;
        const ieds: string[] = [];
        for (const ln of getEls(eqEl, 'LNode')) {
          const ied = ln.getAttribute('iedName');
          if (ied && ied !== 'None' && !ieds.includes(ied)) ieds.push(ied);
        }
        equipment.push({ name: eqName, kind, desc: eqDesc, ieds });
      }

      // Also collect PowerTransformer elements at bay level
      for (const eqEl of getEls(bayEl, 'PowerTransformer')) {
        const eqName = eqEl.getAttribute('name') ?? '';
        const eqDesc = eqEl.getAttribute('desc') ?? undefined;
        const ieds: string[] = [];
        for (const ln of getEls(eqEl, 'LNode')) {
          const ied = ln.getAttribute('iedName');
          if (ied && ied !== 'None' && !ieds.includes(ied)) ieds.push(ied);
        }
        equipment.push({ name: eqName, kind: 'VTR', desc: eqDesc, ieds });
      }

      bays.push({
        name: bayName,
        desc: bayDesc,
        voltageLevel: vlName,
        nominalVoltage,
        equipment,
        col: col++,
      });
    }

    voltageLevels.push({ name: vlName, nominalVoltage, bays, color });
  }

  return { substationName, voltageLevels };
}
