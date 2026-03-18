import type { DiagnosticsSnapshot, IssueDetail } from './types';

export type DiagnosticsListener = (snapshot: ReadonlyMap<string, readonly IssueDetail[]>) => void;

// Diagnostics represent current validator output, not a historical log.
export class DiagnosticsStore {
  private readonly issuesByValidator = new Map<string, IssueDetail[]>();
  private readonly listeners = new Set<DiagnosticsListener>();

  setIssues(validatorId: string, issues: IssueDetail[]): void {
    const normalized = issues.map((issue) => ({
      ...issue,
      validatorId,
    }));
    this.issuesByValidator.set(validatorId, normalized);
    this.notify();
  }

  clearIssues(validatorId: string): void {
    if (!this.issuesByValidator.has(validatorId)) {
      return;
    }
    this.issuesByValidator.delete(validatorId);
    this.notify();
  }

  clearAll(): void {
    if (this.issuesByValidator.size === 0) {
      return;
    }
    this.issuesByValidator.clear();
    this.notify();
  }

  getSnapshot(): DiagnosticsSnapshot {
    const copy = new Map<string, IssueDetail[]>();
    for (const [validatorId, issues] of this.issuesByValidator.entries()) {
      copy.set(
        validatorId,
        issues.map((issue) => ({ ...issue })),
      );
    }
    return copy;
  }

  subscribe(listener: DiagnosticsListener): () => void {
    this.listeners.add(listener);
    listener(this.toReadonlySnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.toReadonlySnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private toReadonlySnapshot(): ReadonlyMap<string, readonly IssueDetail[]> {
    const snapshot = this.getSnapshot();
    return snapshot as ReadonlyMap<string, readonly IssueDetail[]>;
  }
}
