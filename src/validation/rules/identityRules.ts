import type { SclModel } from '../../model/types';
import type { ValidationIssue } from '../types';
import { buildIssueId } from '../utils';

export function runIdentityRules(model: SclModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // DUPLICATE_IED_NAME is covered by LNET_001 — not emitted here.

  for (const ied of model.ieds) {
    if (!ied.name.trim()) {
      issues.push({
        id: buildIssueId('MISSING_REQUIRED_ATTR', `/SCL/IED[missing @name]`),
        severity: 'error',
        category: 'semantic',
        code: 'MISSING_REQUIRED_ATTR',
        message: 'IED is missing required name attribute.',
        path: '/SCL/IED',
        protocol: 'Generic',
        context: {},
        entityRef: { type: 'IED', id: '/SCL/IED' },
        resolved: false,
        fixHint: 'Add unique IED @name.',
      });
    }

    const seenAp = new Map<string, number>();
    for (const ap of ied.accessPoints) {
      const count = (seenAp.get(ap.name) || 0) + 1;
      seenAp.set(ap.name, count);

      if (!ap.name.trim()) {
        issues.push({
          id: buildIssueId('MISSING_REQUIRED_ATTR', `/SCL/IED[@name='${ied.name}']/AccessPoint[missing @name]`),
          severity: 'error',
          category: 'semantic',
          code: 'MISSING_REQUIRED_ATTR',
          message: `AccessPoint in IED '${ied.name}' is missing name.`,
          path: `/SCL/IED[@name='${ied.name}']/AccessPoint`,
          protocol: 'Generic',
          context: { iedName: ied.name },
          entityRef: { type: 'AccessPoint', id: `ied:${ied.name}:ap:missing`, iedName: ied.name },
          resolved: false,
          fixHint: 'Add unique AccessPoint @name.',
        });
      }
    }

    for (const [apName, count] of seenAp.entries()) {
      if (count < 2) {
        continue;
      }
      issues.push({
        id: buildIssueId('DUPLICATE_AP_NAME_WITHIN_IED', `/SCL/IED[@name='${ied.name}']/AccessPoint[@name='${apName}']`),
        severity: 'error',
        category: 'semantic',
        code: 'DUPLICATE_AP_NAME_WITHIN_IED',
        message: `Duplicate AccessPoint '${apName}' inside IED '${ied.name}'.`,
        path: `/SCL/IED[@name='${ied.name}']/AccessPoint[@name='${apName}']`,
        protocol: 'Generic',
        context: { iedName: ied.name, apName },
        entityRef: { type: 'AccessPoint', id: `ied:${ied.name}:ap:${apName}`, iedName: ied.name },
        resolved: false,
        fixHint: 'Rename duplicate AccessPoint names inside the same IED.',
      });
    }
  }

  return issues;
}
