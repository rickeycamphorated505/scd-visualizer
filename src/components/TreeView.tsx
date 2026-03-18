import { useMemo, useState } from 'react';
import type { TreeNodeModel } from '../model/types';

interface TreeViewProps {
  tree: TreeNodeModel[];
  selectedKey?: string;
  onSelect: (id: string) => void;
}

function TreeNode({
  node,
  selectedKey,
  onSelect,
}: {
  node: TreeNodeModel;
  selectedKey?: string;
  onSelect: (id: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length || 0) > 0;

  return (
    <div className="tree-node">
      <div className={`tree-row ${selectedKey === node.id ? 'selected' : ''}`}>
        {hasChildren ? (
          <button className="tree-toggle" onClick={() => setOpen((v) => !v)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}
        <button className="tree-label" onClick={() => onSelect(node.id)} title={node.id}>
          {node.label}
        </button>
      </div>
      {hasChildren && open ? (
        <div className="tree-children">
          {node.children?.map((child) => (
            <TreeNode key={child.id} node={child} selectedKey={selectedKey} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function TreeView({ tree, selectedKey, onSelect }: TreeViewProps): JSX.Element {
  const normalizedTree = useMemo(() => tree, [tree]);

  return (
    <div className="tree-view">
      {normalizedTree.map((node) => (
        <TreeNode key={node.id} node={node} selectedKey={selectedKey} onSelect={onSelect} />
      ))}
    </div>
  );
}
