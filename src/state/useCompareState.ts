import { useMemo } from 'react';
import type { SclModel } from '../model/types';
import { computeDiff } from '../diff/computeDiff';
import type { Change, DiffResult } from '../diff/types';

export interface ChangeFilters {
  type: 'all' | 'added' | 'modified' | 'removed';
  area: 'all' | 'Communication' | 'GOOSE' | 'SV' | 'Reporting' | 'Generic';
  query: string;
}

interface UseCompareStateArgs {
  baselineModel: SclModel | undefined;
  newModel: SclModel | undefined;
  compareVariant: 'single' | 'compare';
  showOnlyChanges: boolean;
  selectedChangeId: string | null;
}

interface UseCompareStateResult {
  diff: DiffResult;
  selectedChange: Change | null;
  compareChanges: Change[];
  changedIeds: string[];
  iedChangeStatus: Record<string, 'added' | 'modified' | 'removed'>;
}

export function useCompareState({
  baselineModel,
  newModel,
  compareVariant,
  showOnlyChanges,
  selectedChangeId,
}: UseCompareStateArgs): UseCompareStateResult {
  const diff: DiffResult = useMemo(() => {
    if (!baselineModel || !newModel || compareVariant !== 'compare') {
      return { changes: [], byEntityKey: {} };
    }
    return computeDiff(baselineModel, newModel);
  }, [baselineModel, newModel, compareVariant]);

  const selectedChange = useMemo(
    () => diff.changes.find((c) => c.id === selectedChangeId) || null,
    [diff.changes, selectedChangeId],
  );

  const compareChanges = useMemo(() => {
    if (!showOnlyChanges) {
      return diff.changes;
    }
    return diff.changes.filter((c) => c.changeType !== 'modified' || c.details.length > 0);
  }, [diff.changes, showOnlyChanges]);

  const changedIeds = useMemo(
    () =>
      Array.from(new Set(diff.changes.map((c) => c.iedName).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [diff.changes],
  );

  const iedChangeStatus = useMemo(() => {
    const status: Record<string, 'added' | 'modified' | 'removed'> = {};
    const rank = { added: 3, modified: 2, removed: 1 } as const;
    for (const change of diff.changes) {
      if (!change.iedName) {
        continue;
      }
      const current = status[change.iedName];
      if (!current || rank[change.changeType] > rank[current]) {
        status[change.iedName] = change.changeType;
      }
    }
    return status;
  }, [diff.changes]);

  return {
    diff,
    selectedChange,
    compareChanges,
    changedIeds,
    iedChangeStatus,
  };
}

