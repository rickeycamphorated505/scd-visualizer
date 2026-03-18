import type { SclModel } from '../../model/types';
import type { ValidationIssue } from '../types';
import { runLandsnetValidationIssues } from '../landsnet/runLandsnetValidation';

export function runLandsnetRules(model: SclModel): ValidationIssue[] {
  return runLandsnetValidationIssues(model);
}
