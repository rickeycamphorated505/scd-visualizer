import type { SclModel } from '../model/types';
import { emitIssues } from '../diagnostics/events';
import type { DiagnosticsStore } from '../diagnostics/store';
import type { IssueDetail } from '../diagnostics/types';
import type { ValidationIssue } from './types';
import { runValidators } from './validators';

export async function runValidation(model: SclModel): Promise<ValidationIssue[]> {
  return runValidators(model);
}

// Adapter so current validation output can be consumed by OpenSCD-style diagnostics.
export function toDiagnosticsIssueDetail(issue: ValidationIssue): IssueDetail {
  return {
    validatorId: inferValidatorId(issue),
    title: issue.code,
    message: issue.message,
    severity: toDiagnosticsSeverity(issue.severity),
  };
}

export function groupValidationDiagnostics(issues: ValidationIssue[]): Map<string, IssueDetail[]> {
  const grouped = new Map<string, IssueDetail[]>();
  for (const issue of issues) {
    const detail = toDiagnosticsIssueDetail(issue);
    const current = grouped.get(detail.validatorId) ?? [];
    current.push(detail);
    grouped.set(detail.validatorId, current);
  }
  return grouped;
}

export async function runValidationDiagnostics(
  model: SclModel,
  options?: {
    store?: DiagnosticsStore;
    eventTarget?: EventTarget;
  },
): Promise<Map<string, IssueDetail[]>> {
  const issues = await runValidation(model);
  const grouped = groupValidationDiagnostics(issues);

  if (options?.store) {
    for (const [validatorId, details] of grouped.entries()) {
      options.store.setIssues(validatorId, details);
    }
  }

  if (options?.eventTarget) {
    for (const details of grouped.values()) {
      emitIssues(options.eventTarget, details);
    }
  }

  return grouped;
}

function inferValidatorId(issue: ValidationIssue): string {
  if (
    issue.code.startsWith('DUPLICATE_IED_') ||
    issue.code.startsWith('DUPLICATE_AP_') ||
    issue.code.startsWith('MISSING_REQUIRED_ATTR')
  ) {
    return 'identity';
  }

  if (
    issue.code.startsWith('CONNECTEDAP_') ||
    issue.code.startsWith('DUPLICATE_CONNECTEDAP_') ||
    issue.code.startsWith('DUPLICATE_IP_OR_MAC') ||
    issue.code.startsWith('DUPLICATE_GSE_SMV_') ||
    issue.code.startsWith('SUBNETWORK_')
  ) {
    return 'communication';
  }

  if (issue.code.startsWith('EXTREF_') || issue.code === 'DATASET_EMPTY') {
    return 'goose';
  }

  if (issue.code.endsWith('_DATASET_MISSING')) {
    return 'control-block';
  }

  if (issue.code.startsWith('LNET_') || issue.code.startsWith('IEC_')) {
    return 'landsnet-compliance';
  }

  return 'validation';
}

function toDiagnosticsSeverity(severity: ValidationIssue['severity']): IssueDetail['severity'] {
  if (severity === 'error') {
    return 'error';
  }
  if (severity === 'warn' || severity === 'warning') {
    return 'warning';
  }
  return 'info';
}
