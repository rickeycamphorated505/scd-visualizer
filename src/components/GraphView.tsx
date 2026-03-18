import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { EdgeModel } from '../model/types';

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  onSelectEdge: (edge: EdgeModel) => void;
  onSelectNode: (nodeId: string) => void;
}

export default function GraphView({ nodes, edges, onSelectEdge, onSelectNode }: GraphViewProps): JSX.Element {
  const memoNodes = useMemo(() => nodes, [nodes]);
  const memoEdges = useMemo(() => edges, [edges]);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    onSelectNode(node.id);
  };

  const onEdgeClick: EdgeMouseHandler = (_, edge) => {
    if (!edge.data) {
      return;
    }
    onSelectEdge(edge.data as EdgeModel);
  };

  return (
    <div className="graph-view">
      <ReactFlow
        fitView
        nodes={memoNodes}
        edges={memoEdges}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background gap={20} size={1} />
        <MiniMap zoomable pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
