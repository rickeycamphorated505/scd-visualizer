import type { DiffResult } from './types';

export interface DiffReport {
  summary: {
    totalChanges: number;
    added: number;
    removed: number;
    modified: number;
  };
  ieds: {
    added: string[];
    removed: string[];
    changed: string[];
  };
  changesByArea: Record<string, number>;
  changes: DiffResult['changes'];
}

export function buildDiffReport(diff: DiffResult): DiffReport {
  const added = diff.changes.filter((c) => c.changeType === 'added').length;
  const removed = diff.changes.filter((c) => c.changeType === 'removed').length;
  const modified = diff.changes.filter((c) => c.changeType === 'modified').length;

  const iedAdded = new Set<string>();
  const iedRemoved = new Set<string>();
  const iedChanged = new Set<string>();
  const changesByArea: Record<string, number> = {};

  for (const change of diff.changes) {
    changesByArea[change.area] = (changesByArea[change.area] || 0) + 1;
    if (change.entityType !== 'IED' || !change.iedName) {
      continue;
    }
    if (change.changeType === 'added') {
      iedAdded.add(change.iedName);
    } else if (change.changeType === 'removed') {
      iedRemoved.add(change.iedName);
    } else {
      iedChanged.add(change.iedName);
    }
  }

  return {
    summary: {
      totalChanges: diff.changes.length,
      added,
      removed,
      modified,
    },
    ieds: {
      added: Array.from(iedAdded).sort((a, b) => a.localeCompare(b)),
      removed: Array.from(iedRemoved).sort((a, b) => a.localeCompare(b)),
      changed: Array.from(iedChanged).sort((a, b) => a.localeCompare(b)),
    },
    changesByArea,
    changes: diff.changes,
  };
}
