import type { SclModel } from '../../model/types';
import type { ValidationIssue } from '../types';
import { buildIssueId } from '../utils';

export function runControlBlockRules(model: SclModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dataSetMap = new Set(model.dataSets.map((d) => `${d.iedName}:${d.name}`));

  const allControls = [...model.gseControls, ...model.svControls, ...model.reportControls];
  for (const cb of allControls) {
    const path = `/SCL/IED[@name='${cb.iedName}']//*[@name='${cb.name}']`;
    if (!cb.datSet || !dataSetMap.has(`${cb.iedName}:${cb.datSet}`)) {
      issues.push({
        id: buildIssueId(`${cb.type}_DATASET_MISSING`, `${cb.key}:datSet`),
        severity: 'error',
        category: 'semantic',
        code: `${cb.type}_DATASET_MISSING`,
        message: `${cb.type} ControlBlock '${cb.name}' references missing DataSet '${cb.datSet || ''}'.`,
        path,
        protocol: cb.type === 'GOOSE' ? 'GOOSE' : cb.type === 'SV' ? 'SV' : 'REPORT',
        context: { iedName: cb.iedName, cbName: cb.name, dataSet: cb.datSet },
        entityRef: {
          type: 'ControlBlock',
          id: cb.key,
          iedName: cb.iedName,
        },
        resolved: false,
        fixHint: 'Create DataSet in LN0/LN or update datSet reference.',
      });
    }
  }

  return issues;
}
