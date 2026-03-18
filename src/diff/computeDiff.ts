import type { DiffResult, EntityIndexItem, Change, FieldDiff } from './types';
import { buildEntityIndex } from './buildIndex';
import type { SclModel } from '../model/types';

export function computeDiff(a: SclModel, b: SclModel): DiffResult {
  const aItems = buildEntityIndex(a);
  const bItems = buildEntityIndex(b);

  const aByComRef = buildMapByComRef(aItems);
  const aByKey = new Map(aItems.map((i) => [i.key, i]));

  const matchedA = new Set<string>();
  const matchedB = new Set<string>();
  const changes: Change[] = [];

  for (const bItem of bItems) {
    const aItem = matchItem(bItem, aByComRef, aByKey);
    if (!aItem) {
      changes.push(createAdded(bItem));
      matchedB.add(bItem.key);
      continue;
    }

    matchedA.add(aItem.key);
    matchedB.add(bItem.key);

    const details = diffAttrs(aItem, bItem);
    if (details.length > 0) {
      changes.push(createModified(aItem, bItem, details));
    }
  }

  for (const aItem of aItems) {
    if (matchedA.has(aItem.key)) {
      continue;
    }
    changes.push(createRemoved(aItem));
  }

  const byEntityKey: Record<string, 'added' | 'modified' | 'removed'> = {};
  for (const change of changes) {
    byEntityKey[change.key] = change.changeType;
  }

  return { changes, byEntityKey };
}

function buildMapByComRef(items: EntityIndexItem[]): Map<string, EntityIndexItem> {
  const map = new Map<string, EntityIndexItem>();
  for (const item of items) {
    if (!item.comRef) {
      continue;
    }
    map.set(item.comRef, item);
  }
  return map;
}

function matchItem(
  target: EntityIndexItem,
  byComRef: Map<string, EntityIndexItem>,
  byKey: Map<string, EntityIndexItem>,
): EntityIndexItem | undefined {
  if (target.comRef && byComRef.has(target.comRef)) {
    return byComRef.get(target.comRef);
  }
  if (byKey.has(target.key)) {
    return byKey.get(target.key);
  }
  return undefined;
}

function diffAttrs(a: EntityIndexItem, b: EntityIndexItem): FieldDiff[] {
  const fields = new Set<string>([...Object.keys(a.attrs), ...Object.keys(b.attrs)]);
  const diffs: FieldDiff[] = [];
  for (const field of fields) {
    const before = a.attrs[field] || '';
    const after = b.attrs[field] || '';
    if (before !== after) {
      diffs.push({ field, before, after });
    }
  }
  return diffs;
}

function createAdded(item: EntityIndexItem): Change {
  return {
    id: stableId(`added|${item.key}`),
    changeType: 'added',
    entityType: item.entityType,
    area: item.area,
    key: item.key,
    comRef: item.comRef,
    path: item.path,
    summary: `NEW: ${item.entityType} ${item.key}`,
    iedName: item.iedName,
    details: Object.entries(item.attrs).map(([field, after]) => ({ field, before: '', after })),
  };
}

function createRemoved(item: EntityIndexItem): Change {
  return {
    id: stableId(`removed|${item.key}`),
    changeType: 'removed',
    entityType: item.entityType,
    area: item.area,
    key: item.key,
    comRef: item.comRef,
    path: item.path,
    summary: `REMOVED: ${item.entityType} ${item.key}`,
    iedName: item.iedName,
    details: Object.entries(item.attrs).map(([field, before]) => ({ field, before, after: '' })),
  };
}

function createModified(_a: EntityIndexItem, b: EntityIndexItem, details: FieldDiff[]): Change {
  const first = details.find((d) => d.field === 'confRev') || details[0];
  const isConfRev = first.field === 'confRev';
  return {
    id: stableId(`modified|${b.key}`),
    changeType: 'modified',
    entityType: b.entityType,
    area: b.area,
    key: b.key,
    comRef: b.comRef,
    path: b.path,
    summary: isConfRev
      ? `CHANGED: ${b.entityType} ${b.key} ConfRev ${first.before} -> ${first.after}`
      : `CHANGED: ${b.entityType} ${b.key} ${first.field} ${first.before} -> ${first.after}`,
    iedName: b.iedName,
    details,
  };
}

function stableId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(Math.abs(h));
}
