export type EquipmentKind =
  | 'CBR' | 'DIS' | 'GG' | 'CTR' | 'VTR' | 'IFL' | 'GV' | 'BAY' | 'BUS';

export interface SldEquipment {
  name: string;
  kind: EquipmentKind;
  desc?: string;
  /** IED names bound via <LNode> */
  ieds: string[];
}

export interface SldBay {
  name: string;
  desc?: string;
  voltageLevel: string;
  nominalVoltage: number;
  equipment: SldEquipment[];
  /** column index assigned by parser */
  col: number;
}

export interface SldVoltageLevel {
  name: string;
  nominalVoltage: number;
  bays: SldBay[];
  /** color token for this voltage level */
  color: string;
}

export interface SldModel {
  substationName: string;
  voltageLevels: SldVoltageLevel[];
}
