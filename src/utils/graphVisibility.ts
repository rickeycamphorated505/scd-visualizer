import type { EdgeModel, IedModel, SclModel } from '../model/types';
import type { UiState } from '../state/uiStore';

export interface DerivedIssue {
  id: string;
  severity: 'info' | 'warn';
  title: string;
  detail: string;
}

export interface VisibleGraph {
  visibleIeds: IedModel[];
  visibleEdges: EdgeModel[];
  issues: DerivedIssue[];
}

export function deriveVisibleGraph(model: SclModel | undefined, ui: UiState): VisibleGraph {
  if (!model) {
    return { visibleIeds: [], visibleEdges: [], issues: [] };
  }

  let allIeds = model.ieds;
  if (ui.iedFilter !== 'all' && ui.iedFilter.length > 0) {
    const set = new Set(ui.iedFilter);
    allIeds = allIeds.filter((ied) => set.has(ied.name));
  }

  let edges = model.edges.filter((edge) => ui.protocolFilter[edge.signalType]);
  if (ui.iedFilter !== 'all' && ui.iedFilter.length > 0) {
    const set = new Set(ui.iedFilter);
    edges = edges.filter((e) => set.has(e.publisherIed) && set.has(e.subscriberIed));
  }

  const hasValidFocus = Boolean(ui.focusIedId && allIeds.some((ied) => ied.name === ui.focusIedId));

  if (ui.resolutionFilter === 'resolved') {
    edges = edges.filter((edge) => edge.status === 'resolved');
  } else if (ui.resolutionFilter === 'unresolved') {
    edges = edges.filter((edge) => edge.status !== 'resolved');
  }

  const q = ui.searchQuery.trim().toLowerCase();
  if (q) {
    const iedMatch = new Set(
      allIeds.filter((ied) => ied.name.toLowerCase().includes(q)).map((ied) => ied.name),
    );
    edges = edges.filter((edge) => {
      return (
        edge.publisherIed.toLowerCase().includes(q) ||
        edge.subscriberIed.toLowerCase().includes(q) ||
        (edge.controlBlockName || '').toLowerCase().includes(q) ||
        (edge.dataSetName || '').toLowerCase().includes(q) ||
        iedMatch.has(edge.publisherIed) ||
        iedMatch.has(edge.subscriberIed)
      );
    });
  }

  let visibleIeds = allIeds;
  let visibleEdges = edges;

  if (hasValidFocus && ui.focusIedId) {
    const nodesInScope = collectNodesInScope(edges, ui.focusIedId, ui.directionFilter, ui.neighborDepth);
    visibleIeds = allIeds.filter((ied) => nodesInScope.has(ied.name));
    visibleEdges = edges.filter(
      (edge) => nodesInScope.has(edge.publisherIed) && nodesInScope.has(edge.subscriberIed),
    );
  }

  if (ui.hideIsolated) {
    const connected = new Set<string>();
    for (const edge of visibleEdges) {
      connected.add(edge.publisherIed);
      connected.add(edge.subscriberIed);
    }
    visibleIeds = visibleIeds.filter((ied) => connected.has(ied.name) || (hasValidFocus && ied.name === ui.focusIedId));
  }

  const issues = deriveIssues(model, visibleEdges);
  return { visibleIeds, visibleEdges, issues };
}

function collectNodesInScope(
  edges: EdgeModel[],
  root: string,
  direction: UiState['directionFilter'],
  depth: UiState['neighborDepth'],
): Set<string> {
  const out = new Map<string, Set<string>>();
  const inc = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!out.has(edge.publisherIed)) {
      out.set(edge.publisherIed, new Set());
    }
    out.get(edge.publisherIed)!.add(edge.subscriberIed);

    if (!inc.has(edge.subscriberIed)) {
      inc.set(edge.subscriberIed, new Set());
    }
    inc.get(edge.subscriberIed)!.add(edge.publisherIed);
  }

  const visited = new Set<string>([root]);
  const queue: Array<{ node: string; level: number }> = [{ node: root, level: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (depth !== 'all' && current.level >= depth) {
      continue;
    }

    const next = new Set<string>();
    if (direction !== 'incoming') {
      for (const n of out.get(current.node) || []) {
        next.add(n);
      }
    }
    if (direction !== 'outgoing') {
      for (const n of inc.get(current.node) || []) {
        next.add(n);
      }
    }

    for (const n of next) {
      if (visited.has(n)) {
        continue;
      }
      visited.add(n);
      queue.push({ node: n, level: current.level + 1 });
    }
  }

  return visited;
}

function deriveIssues(model: SclModel, visibleEdges: EdgeModel[]): DerivedIssue[] {
  const issues: DerivedIssue[] = [];

  for (const edge of visibleEdges) {
    if (edge.status !== 'resolved') {
      issues.push({
        id: `issue:edge:${edge.key}`,
        severity: edge.status === 'unresolved' ? 'warn' : 'info',
        title: `${edge.signalType} ${edge.publisherIed} -> ${edge.subscriberIed}`,
        detail: edge.reason || `Edge is ${edge.status}.`,
      });
    }
  }

  for (const ied of model.ieds) {
    for (const ap of ied.accessPoints) {
      if (!ap.ip && !ap.mac) {
        issues.push({
          id: `issue:comm:${ied.name}:${ap.name}`,
          severity: 'info',
          title: `Missing comm props for ${ied.name}/${ap.name}`,
          detail: 'No IP/MAC found in Communication section for this AccessPoint.',
        });
      }
    }
  }

  return issues;
}
