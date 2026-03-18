import type { IssueDetail } from './types';

export const ISSUE_EVENT_NAME = 'issue';

export function newIssueEvent(detail: IssueDetail): CustomEvent<IssueDetail> {
  return new CustomEvent<IssueDetail>(ISSUE_EVENT_NAME, {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function emitIssue(target: EventTarget, detail: IssueDetail): boolean {
  return target.dispatchEvent(newIssueEvent(detail));
}

export function emitIssues(target: EventTarget, issues: IssueDetail[]): void {
  for (const issue of issues) {
    emitIssue(target, issue);
  }
}
