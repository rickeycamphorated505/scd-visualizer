import type { EdgeModel, IedModel } from '../model/types';
import type { DiffResult } from './types';

export interface DiffDecorations {
  nodeStatus: Record<string, 'added' | 'modified' | 'removed'>;
  edgeStatus: Record<string, 'added' | 'modified' | 'removed'>;
}

export function applyDiffDecorations(result: DiffResult, ieds: IedModel[], edges: EdgeModel[]): DiffDecorations {
  const nodeStatus: Record<string, 'added' | 'modified' | 'removed'> = {};
  const edgeStatus: Record<string, 'added' | 'modified' | 'removed'> = {};

  for (const change of result.changes) {
    if (change.entityType === 'IED' && change.iedName) {
      nodeStatus[change.iedName] = change.changeType;
    }
    if (change.entityType === 'Flow') {
      const k = `FLOW/${change.area === 'GOOSE' ? 'GOOSE' : change.area === 'SV' ? 'SV' : 'REPORT'}`;
      for (const edge of edges) {
        const ek = `FLOW/${edge.signalType}/${edge.publisherIed}/${edge.subscriberIed}/${edge.controlBlockName || ''}`;
        if (change.key === ek || change.key.startsWith(k)) {
          edgeStatus[edge.key] = change.changeType;
        }
      }
    }
  }

  for (const ied of ieds) {
    if (!nodeStatus[ied.name]) {
      continue;
    }
  }

  return { nodeStatus, edgeStatus };
}
