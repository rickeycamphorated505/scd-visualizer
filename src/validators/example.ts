import { emitIssues } from '../diagnostics/events';
import type { DiagnosticsStore } from '../diagnostics/store';
import type { IssueDetail } from '../diagnostics/types';

export const SCHEMA_VALIDATOR_ID = 'schema';
export const TEMPLATES_VALIDATOR_ID = 'templates';

export interface ValidatorRunResult {
  byValidator: Map<string, IssueDetail[]>;
  allIssues: IssueDetail[];
}

export function validateSchema(xml: string): IssueDetail[] {
  const issues: IssueDetail[] = [];

  if (!xml.trim()) {
    issues.push({
      validatorId: SCHEMA_VALIDATOR_ID,
      title: 'XML payload is empty',
      message: 'Provide SCL/SCD XML before running schema diagnostics.',
      severity: 'error',
    });
    return issues;
  }

  const doc = parseXml(xml);
  if (!doc) {
    issues.push({
      validatorId: SCHEMA_VALIDATOR_ID,
      title: 'XML parse error',
      message: 'The XML is not well formed.',
      severity: 'error',
    });
    return issues;
  }

  const rootName = doc.documentElement?.nodeName;
  if (rootName !== 'SCL') {
    issues.push({
      validatorId: SCHEMA_VALIDATOR_ID,
      title: 'Unexpected root element',
      message: `Expected <SCL> root but found <${rootName || 'unknown'}>.`,
      severity: 'error',
    });
  }

  if (doc.querySelectorAll('IED').length === 0) {
    issues.push({
      validatorId: SCHEMA_VALIDATOR_ID,
      title: 'No IED elements found',
      message: 'Schema-level minimum content is missing (IED list is empty).',
      severity: 'warning',
    });
  }

  return issues;
}

export function validateTemplates(xml: string): IssueDetail[] {
  const issues: IssueDetail[] = [];
  const doc = parseXml(xml);
  if (!doc) {
    issues.push({
      validatorId: TEMPLATES_VALIDATOR_ID,
      title: 'Template validation skipped',
      message: 'XML could not be parsed, template checks not executed.',
      severity: 'error',
    });
    return issues;
  }

  const dataSetNames = new Set<string>();
  for (const dataSet of Array.from(doc.querySelectorAll('DataSet'))) {
    const name = dataSet.getAttribute('name')?.trim();
    if (name) {
      dataSetNames.add(name);
    }
  }

  if (dataSetNames.size === 0) {
    issues.push({
      validatorId: TEMPLATES_VALIDATOR_ID,
      title: 'No DataSet definitions',
      message: 'Control blocks cannot bind to datasets if none are defined.',
      severity: 'warning',
    });
  }

  const controlBlocks = [
    ...Array.from(doc.querySelectorAll('GSEControl')),
    ...Array.from(doc.querySelectorAll('SMVControl')),
    ...Array.from(doc.querySelectorAll('ReportControl')),
  ];

  for (const controlBlock of controlBlocks) {
    const controlName = controlBlock.getAttribute('name') || controlBlock.nodeName;
    const dataSetRef = controlBlock.getAttribute('datSet') || '';

    if (!dataSetRef.trim()) {
      issues.push({
        validatorId: TEMPLATES_VALIDATOR_ID,
        title: `${controlName}: missing datSet`,
        message: `${controlBlock.nodeName} does not reference any DataSet.`,
        severity: 'warning',
      });
      continue;
    }

    if (!dataSetNames.has(dataSetRef)) {
      issues.push({
        validatorId: TEMPLATES_VALIDATOR_ID,
        title: `${controlName}: unknown DataSet`,
        message: `Referenced DataSet '${dataSetRef}' was not found in the file.`,
        severity: 'error',
      });
    }
  }

  return issues;
}

// OpenSCD-style runner: run each validator, replace current issues per validator,
// and optionally emit issue events for a Diagnostics UI listener.
export function runExampleValidators(
  xml: string,
  options?: {
    store?: DiagnosticsStore;
    eventTarget?: EventTarget;
  },
): ValidatorRunResult {
  const schemaIssues = validateSchema(xml);
  const templateIssues = validateTemplates(xml);

  options?.store?.setIssues(SCHEMA_VALIDATOR_ID, schemaIssues);
  options?.store?.setIssues(TEMPLATES_VALIDATOR_ID, templateIssues);

  if (options?.eventTarget) {
    emitIssues(options.eventTarget, schemaIssues);
    emitIssues(options.eventTarget, templateIssues);
  }

  return {
    byValidator: new Map<string, IssueDetail[]>([
      [SCHEMA_VALIDATOR_ID, schemaIssues],
      [TEMPLATES_VALIDATOR_ID, templateIssues],
    ]),
    allIssues: [...schemaIssues, ...templateIssues],
  };
}

function parseXml(xml: string): Document | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}
