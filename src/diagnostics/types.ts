export type IssueSeverity = 'error' | 'warning' | 'info';

// Mirrors OpenSCD issue shape: validator grouping + title/message fields.
export interface IssueDetail {
  validatorId: string;
  title: string;
  message?: string;
  severity?: IssueSeverity;
}

export type DiagnosticsSnapshot = Map<string, IssueDetail[]>;
