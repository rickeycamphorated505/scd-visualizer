export type ChangeType = 'added' | 'modified' | 'removed';

export interface FieldDiff {
  field: string;
  before: string;
  after: string;
}

export interface Change {
  id: string;
  changeType: ChangeType;
  entityType: 'IED' | 'DataSet' | 'ControlBlock' | 'ConnectedAP' | 'Flow' | 'Generic';
  area: 'Communication' | 'GOOSE' | 'SV' | 'Reporting' | 'Generic';
  key: string;
  comRef?: string;
  path: string;
  summary: string;
  iedName?: string;
  details: FieldDiff[];
}

export interface EntityIndexItem {
  key: string;
  comRef?: string;
  entityType: Change['entityType'];
  area: Change['area'];
  path: string;
  iedName?: string;
  attrs: Record<string, string>;
}

export interface DiffResult {
  changes: Change[];
  byEntityKey: Record<string, ChangeType>;
}
