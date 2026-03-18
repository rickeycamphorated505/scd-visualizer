import type { Edge, Node } from 'reactflow';
import type { EdgeModel, IedModel, SignalMode } from '../model/types';

export function buildGraphNodes(ieds: IedModel[], edges: EdgeModel[], focusIed?: string): Node[] {
  if (!focusIed) {
    return ieds.map((ied, index) => ({
      id: ied.name,
      data: {
        label: ied.name,
        accessPoints: ied.accessPoints,
      },
      position: {
        x: 120 + (index % 4) * 260,
        y: 80 + Math.floor(index / 4) * 180,
      },
      type: 'default',
    }));
  }

  const connected = new Set<string>();
  for (const edge of edges) {
    if (edge.publisherIed === focusIed) {
      connected.add(edge.subscriberIed);
    }
    if (edge.subscriberIed === focusIed) {
      connected.add(edge.publisherIed);
    }
  }

  const centerX = 520;
  const centerY = 300;
  const near = ieds.filter((i) => i.name !== focusIed && connected.has(i.name));
  const far = ieds.filter((i) => i.name !== focusIed && !connected.has(i.name));

  const nodes: Node[] = [];

  const focusedIed = ieds.find((i) => i.name === focusIed);
  if (focusedIed) {
    nodes.push({
      id: focusedIed.name,
      data: {
        label: focusedIed.name,
        accessPoints: focusedIed.accessPoints,
      },
      position: { x: centerX, y: centerY },
      style: {
        border: '2px solid #0b6e4f',
        background: '#e8fbf3',
      },
      type: 'default',
    });
  }

  near.forEach((ied, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(near.length, 1);
    const radius = 220;
    nodes.push({
      id: ied.name,
      data: {
        label: ied.name,
        accessPoints: ied.accessPoints,
      },
      position: {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      },
      style: {
        border: '1px solid #1f6feb',
        background: '#f4f9ff',
      },
      type: 'default',
    });
  });

  far.forEach((ied, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(far.length, 1);
    const radius = 420;
    nodes.push({
      id: ied.name,
      data: {
        label: ied.name,
        accessPoints: ied.accessPoints,
      },
      position: {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      },
      style: {
        opacity: 0.7,
      },
      type: 'default',
    });
  });

  return nodes;
}

export function buildGraphEdges(models: EdgeModel[], mode: SignalMode, focusIed?: string): Edge[] {
  const filtered = models.filter((edge) => {
    if (mode === 'goose') {
      return edge.signalType === 'GOOSE';
    }
    if (mode === 'sv') {
      return edge.signalType === 'SV';
    }
    if (mode === 'report') {
      return edge.signalType === 'REPORT';
    }
    return true;
  });

  return filtered.map((edgeModel) => {
    const isFocused = focusIed
      ? edgeModel.publisherIed === focusIed || edgeModel.subscriberIed === focusIed
      : true;

    const strokeColor =
      edgeModel.signalType === 'GOOSE'
        ? '#dd6b20'
        : edgeModel.signalType === 'SV'
          ? '#1f6feb'
          : '#0b6e4f';

    return {
      id: edgeModel.key,
      source: edgeModel.publisherIed,
      target: edgeModel.subscriberIed,
      animated: edgeModel.status !== 'resolved' || edgeModel.signalType === 'REPORT',
      style: {
        stroke: strokeColor,
        strokeWidth: edgeModel.status === 'resolved' ? 2.6 : 1.6,
        opacity: isFocused ? 1 : 0.2,
      },
      label: `${edgeModel.signalType}:${edgeModel.controlBlockName || '?'}`,
      data: edgeModel,
    };
  });
}
