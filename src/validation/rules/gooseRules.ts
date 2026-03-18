import type { SclModel } from '../../model/types';
import type { ValidationIssue } from '../types';
import { buildIssueId } from '../utils';

export function runGooseRules(model: SclModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const dataSetMap = new Map(model.dataSets.map((d) => [`${d.iedName}:${d.name}`, d]));

  for (const gcb of model.gseControls) {
    const ds = gcb.datSet ? dataSetMap.get(`${gcb.iedName}:${gcb.datSet}`) : undefined;
    if (!ds) {
      continue;
    }
    if (ds.fcdas.length === 0) {
      issues.push({
        id: buildIssueId('DATASET_EMPTY', `dataset:${ds.key}`),
        severity: 'warn',
        category: 'semantic',
        code: 'DATASET_EMPTY',
        message: `DataSet '${ds.name}' is empty (no FCDA).`,
        path: `/SCL/IED[@name='${ds.iedName}']//DataSet[@name='${ds.name}']`,
        protocol: 'GOOSE',
        context: { iedName: ds.iedName, dataSet: ds.name },
        entityRef: { type: 'DataSet', id: ds.key, iedName: ds.iedName },
        resolved: false,
        fixHint: 'Add FCDA members to the DataSet.',
      });
    }
  }

  for (const [index, ext] of model.extRefs.entries()) {
    const path = `/SCL/IED[@name='${ext.ownerIed}']//ExtRef[${index + 1}]`;
    const service = (ext.extRef.serviceType || '').toLowerCase();
    const protocol = inferExtRefProtocol(service);

    if (isEmptyExtRef(ext.extRef)) {
      issues.push({
        id: buildIssueId('EXTREF_EMPTY', `${path}:${ext.ownerIed}`),
        severity: 'error',
        category: 'semantic',
        code: 'EXTREF_EMPTY',
        message: `ExtRef in '${ext.ownerIed}' has no source binding attributes.`,
        path,
        protocol,
        context: {
          iedName: ext.ownerIed,
          ldInst: ext.extRef.ldInst,
          lnClass: ext.extRef.lnClass,
          lnInst: ext.extRef.lnInst,
        },
        entityRef: { type: 'ExtRef', id: `${ext.ownerIed}:extref:${index}`, iedName: ext.ownerIed },
        resolved: false,
        fixHint: 'Set ExtRef source fields (for example iedName/srcCBName/ldInst/doName/daName) or remove unused ExtRef.',
      });
    }
    // EXTREF_UNRESOLVED is now covered by IEC_003
  }

  return issues;
}

function hasText(value?: string): boolean {
  return Boolean(value && value.trim());
}

function isEmptyExtRef(extRef: SclModel['extRefs'][number]['extRef']): boolean {
  const bindingFields = [
    extRef.iedName,
    extRef.ldInst,
    extRef.srcLDInst,
    extRef.prefix,
    extRef.lnClass,
    extRef.lnInst,
    extRef.doName,
    extRef.daName,
    extRef.srcCBName,
    extRef.intAddr,
  ];
  return !bindingFields.some(hasText);
}

function inferExtRefProtocol(serviceType: string): 'GOOSE' | 'SV' | 'REPORT' | 'Generic' {
  if (serviceType.includes('goose')) {
    return 'GOOSE';
  }
  if (serviceType.includes('smv') || serviceType.includes('sv')) {
    return 'SV';
  }
  if (serviceType.includes('report') || serviceType.includes('rpt')) {
    return 'REPORT';
  }
  return 'Generic';
}
