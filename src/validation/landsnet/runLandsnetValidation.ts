import type { SclModel } from '../../model/types';
import type { ValidationIssue } from '../types';
import { buildLandsnetDictionaries } from './buildDictionaries';
import { runLandsnetChecks } from './checks';
import type { LandsnetOutputs, LandsnetValidationReport } from './types';

export function runLandsnetValidation(model: SclModel): LandsnetValidationReport {
  const dictionaries = buildLandsnetDictionaries(model);
  const { issues, checks } = runLandsnetChecks(model, dictionaries);
  const outputs = buildOutputs(model, dictionaries, issues);

  return {
    profile: 'landsnet-compliance',
    generatedAt: new Date().toISOString(),
    totals: {
      gooseControls: model.gseControls.length,
      svControls: model.svControls.length,
      reportControls: model.reportControls.length,
    },
    checks,
    issues,
    dictionaries,
    outputs,
  };
}

export function runLandsnetValidationIssues(model: SclModel): ValidationIssue[] {
  return runLandsnetValidation(model).issues;
}

function buildOutputs(model: SclModel, reportDict: ReturnType<typeof buildLandsnetDictionaries>, issues: ValidationIssue[]): LandsnetOutputs {
  const out_MMS: LandsnetOutputs['out_MMS'] = model.reportControls.map((ctrl) => ({
    iedName: ctrl.iedName,
    reportControl: ctrl.name,
    rptId: ctrl.rptId,
    dataset: ctrl.datSet,
    confRev: ctrl.confRev,
    indexed: ctrl.indexed,
    validationErrors: collectErrors(issues, ctrl.iedName, ctrl.name, 'REPORT'),
  }));

  const out_MMS_datasets: LandsnetOutputs['out_MMS_datasets'] = [];
  for (const [iedName, entries] of Object.entries(reportDict.MMS_dataset_dict)) {
    for (const entry of entries) {
      out_MMS_datasets.push({
        iedName,
        reportControl: entry.ownerControl || '',
        rptId: model.reportControls.find((ctrl) => ctrl.iedName === iedName && ctrl.name === entry.ownerControl)?.rptId,
        dataset: entry.dataset,
        signals: entry.signals,
      });
    }
  }

  const out_goose: LandsnetOutputs['out_goose'] = [];
  for (const [iedName, entries] of Object.entries(reportDict.GOOSE_dict)) {
    for (const entry of entries) {
      out_goose.push({
        iedName,
        controlBlockName: entry.controlBlockName,
        dataset: entry.dataset,
        confRev: entry.confRev,
        mac: entry.mac,
        appid: entry.appid,
        vlanId: entry.vlanId,
        vlanPriority: entry.vlanPriority,
        minTime: entry.minTime,
        maxTime: entry.maxTime,
        subscribers: entry.subscribers,
        validationErrors: collectErrors(issues, iedName, entry.controlBlockName, 'GOOSE'),
      });
    }
  }

  const out_goose_datasets: LandsnetOutputs['out_goose_datasets'] = [];
  for (const [iedName, entries] of Object.entries(reportDict.GOOSE_dataset_dict)) {
    for (const entry of entries) {
      out_goose_datasets.push({
        iedName,
        controlBlockName: entry.ownerControl || '',
        dataset: entry.dataset,
        signals: entry.signals,
      });
    }
  }

  const out_sv: LandsnetOutputs['out_sv'] = [];
  for (const [iedName, entries] of Object.entries(reportDict.SV_dict)) {
    for (const entry of entries) {
      out_sv.push({
        iedName,
        smvId: entry.smvId,
        controlBlockName: entry.controlBlockName,
        dataset: entry.dataset,
        confRev: entry.confRev,
        mac: entry.mac,
        appid: entry.appid,
        vlanId: entry.vlanId,
        vlanPriority: entry.vlanPriority,
        subscribers: entry.subscribers,
        validationErrors: collectErrors(issues, iedName, entry.controlBlockName, 'SV'),
      });
    }
  }

  const ieds_sw_filter_template: LandsnetOutputs['ieds_sw_filter_template'] = {};
  for (const ied of model.ieds) {
    const subscribers = Array.from(
      new Set(
        model.edges
          .filter((edge) => edge.publisherIed === ied.name)
          .map((edge) => edge.subscriberIed)
          .filter((name) => /EW\d+/i.test(name)),
      ),
    ).sort((a, b) => a.localeCompare(b));
    ieds_sw_filter_template[ied.name] = [subscribers, ['x/x']];
  }

  return {
    out_MMS,
    out_MMS_datasets,
    out_goose,
    out_goose_datasets,
    out_sv,
    ieds_sw_filter_template,
  };
}

function collectErrors(
  issues: ValidationIssue[],
  iedName: string,
  controlName: string,
  protocol: 'GOOSE' | 'SV' | 'REPORT',
): string[] {
  return Array.from(
    new Set(
      issues
        .filter((issue) => issue.protocol === protocol)
        .filter((issue) => {
          const contextMatch = issue.context.iedName === iedName && issue.context.cbName === controlName;
          const entityMatch = issue.entityRef.iedName === iedName && issue.message.includes(controlName);
          return contextMatch || entityMatch;
        })
        .map((issue) => issue.code),
    ),
  ).sort((a, b) => a.localeCompare(b));
}
