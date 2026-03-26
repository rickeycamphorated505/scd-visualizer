import type { SldVoltageLevel } from './types';

export const BAY_WIDTH = 120;
export const ROW_HEIGHT = 110;
export const BUS_Y_TOP = 60;
export const BUS_Y_BOT = 180;
export const SYMBOL_SIZE = 60;
export const SYMBOL_HEIGHT = 80;
export const VL_HEADER_HEIGHT = 48;
export const IED_CHIP_HEIGHT = 22;
export const IED_CHIP_GAP = 4;
export const LEFT_MARGIN = 80;

export interface LayoutEquipment {
  name: string;
  kind: string;
  desc?: string;
  ieds: string[];
  x: number;
  y: number;
  chipStartY: number;
}

export interface LayoutBay {
  name: string;
  col: number;
  x: number;
  equipment: LayoutEquipment[];
}

export interface LayoutVoltageLevel {
  name: string;
  color: string;
  nominalVoltage: number;
  yOffset: number;
  totalHeight: number;
  busYTop: number;
  busYBot: number;
  busWidth: number;
  bays: LayoutBay[];
}

export function computeLayout(voltageLevels: SldVoltageLevel[]): LayoutVoltageLevel[] {
  const result: LayoutVoltageLevel[] = [];
  let yOffset = 0;

  for (const vl of voltageLevels) {
    const bayCount = Math.max(vl.bays.length, 1);
    const busWidth = LEFT_MARGIN + bayCount * BAY_WIDTH;

    const maxEquip = vl.bays.reduce((m, b) => Math.max(m, b.equipment.length), 0);
    const maxIeds = vl.bays.reduce(
      (m, b) => Math.max(m, b.equipment.reduce((n, e) => n + e.ieds.length, 0)),
      0,
    );

    const feederHeight =
      Math.max(maxEquip, 1) * ROW_HEIGHT +
      maxIeds * (IED_CHIP_HEIGHT + IED_CHIP_GAP) +
      40;

    const totalHeight = VL_HEADER_HEIGHT + BUS_Y_BOT + 20 + feederHeight;
    const busYTop = yOffset + VL_HEADER_HEIGHT + BUS_Y_TOP;
    const busYBot = yOffset + VL_HEADER_HEIGHT + BUS_Y_BOT;

    const bays: LayoutBay[] = vl.bays.map((bay) => {
      const x = LEFT_MARGIN + bay.col * BAY_WIDTH + BAY_WIDTH / 2;
      let equipY = busYBot + ROW_HEIGHT * 0.6;

      const equipment: LayoutEquipment[] = bay.equipment.map((eq) => {
        const y = equipY;
        const chipStartY = y + SYMBOL_HEIGHT / 2 + 8;
        const chipCount = eq.ieds.length;
        equipY += ROW_HEIGHT + chipCount * (IED_CHIP_HEIGHT + IED_CHIP_GAP);
        return { ...eq, x, y, chipStartY };
      });

      return { name: bay.name, col: bay.col, x, equipment };
    });

    result.push({
      name: vl.name,
      color: vl.color,
      nominalVoltage: vl.nominalVoltage,
      yOffset,
      totalHeight,
      busYTop,
      busYBot,
      busWidth,
      bays,
    });

    yOffset += totalHeight + 40;
  }

  return result;
}
