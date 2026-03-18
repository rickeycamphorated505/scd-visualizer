import type { ValidationIssue } from '../types';

export interface LandsnetAccessPointInfo {
  apName: string;
  subNetwork?: string;
  ip?: string;
  netmask?: string;
  gateway?: string;
  mac?: string;
}

export interface LandsnetMmsControl {
  reportControl: string;
  rptId?: string;
  dataset?: string;
  confRev?: string;
  indexed?: boolean;
}

export interface LandsnetGooseControl {
  controlBlockName: string;
  dataset?: string;
  confRev?: string;
  mac?: string;
  appid?: string;
  vlanId?: string;
  vlanPriority?: string;
  minTime?: string;
  maxTime?: string;
  subscribers: string[];
}

export interface LandsnetSvControl {
  smvId?: string;
  controlBlockName: string;
  dataset?: string;
  confRev?: string;
  mac?: string;
  appid?: string;
  vlanId?: string;
  vlanPriority?: string;
  subscribers: string[];
}

export interface LandsnetDatasetSignals {
  ownerControl?: string;
  dataset: string;
  signals: string[];
}

export interface LandsnetDictionaries {
  IED_dict: Record<string, { accessPoints: LandsnetAccessPointInfo[] }>;
  MMS_dict: Record<string, LandsnetMmsControl[]>;
  MMS_dataset_dict: Record<string, LandsnetDatasetSignals[]>;
  GOOSE_dict: Record<string, LandsnetGooseControl[]>;
  GOOSE_dataset_dict: Record<string, LandsnetDatasetSignals[]>;
  SV_dict: Record<string, LandsnetSvControl[]>;
  SV_dataset_dict: Record<string, LandsnetDatasetSignals[]>;
}

export interface LandsnetCheckSummary {
  id: number;
  code: string;
  title: string;
  passed: boolean;
  issueCount: number;
}

export interface LandsnetOutputs {
  out_MMS: Array<{
    iedName: string;
    reportControl: string;
    rptId?: string;
    dataset?: string;
    confRev?: string;
    indexed?: boolean;
    validationErrors: string[];
  }>;
  out_MMS_datasets: Array<{
    iedName: string;
    reportControl: string;
    rptId?: string;
    dataset: string;
    signals: string[];
  }>;
  out_goose: Array<{
    iedName: string;
    controlBlockName: string;
    dataset?: string;
    confRev?: string;
    mac?: string;
    appid?: string;
    vlanId?: string;
    vlanPriority?: string;
    minTime?: string;
    maxTime?: string;
    subscribers: string[];
    validationErrors: string[];
  }>;
  out_goose_datasets: Array<{
    iedName: string;
    controlBlockName: string;
    dataset: string;
    signals: string[];
  }>;
  out_sv: Array<{
    iedName: string;
    smvId?: string;
    controlBlockName: string;
    dataset?: string;
    confRev?: string;
    mac?: string;
    appid?: string;
    vlanId?: string;
    vlanPriority?: string;
    subscribers: string[];
    validationErrors: string[];
  }>;
  ieds_sw_filter_template: Record<string, [string[], [string]]>;
}

export interface LandsnetValidationReport {
  profile: 'landsnet-compliance';
  generatedAt: string;
  totals: {
    gooseControls: number;
    svControls: number;
    reportControls: number;
  };
  checks: LandsnetCheckSummary[];
  issues: ValidationIssue[];
  dictionaries: LandsnetDictionaries;
  outputs: LandsnetOutputs;
}
