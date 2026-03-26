import type { SclModel } from '../model/types';
import type { ValidationIssue } from './types';
import { runCommunicationRules } from './rules/communicationRules';
import { runControlBlockRules } from './rules/controlBlockRules';
import { runGooseRules } from './rules/gooseRules';
import { runIdentityRules } from './rules/identityRules';
import { runLandsnetRules } from './rules/landsnetRules';
export type ValidatorFn = (model: SclModel) => ValidationIssue[] | Promise<ValidationIssue[]>;

export const validators: ValidatorFn[] = [
  runIdentityRules,
  runCommunicationRules,
  runGooseRules,
  runControlBlockRules,
  runLandsnetRules,
];

export async function runValidators(model: SclModel): Promise<ValidationIssue[]> {
  const issueBatches = await Promise.all(validators.map((fn) => fn(model)));
  const merged = issueBatches.flat().map(normalizeIssue);
  const dedup = new Map<string, ValidationIssue>();
  for (const issue of merged) {
    dedup.set(issue.id, issue);
  }
  return Array.from(dedup.values());
}

function normalizeIssue(issue: ValidationIssue): ValidationIssue {
  const quick = issue.fixHint || issue.quickFix;
  return {
    ...issue,
    severity: issue.severity === 'warning' ? 'warn' : issue.severity,
    quickFix: quick,
    fixHint: quick,
  };
}
