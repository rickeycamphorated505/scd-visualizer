import { createPortal } from 'react-dom';

interface CompareAssignDialogProps {
  fileName: string;
  onAssign: (slot: 'A' | 'B') => void;
  onCancel: () => void;
}

export default function CompareAssignDialog({ fileName, onAssign, onCancel }: CompareAssignDialogProps): JSX.Element {
  const shortName = fileName.length > 50 ? `…${fileName.slice(-47)}` : fileName;

  return createPortal(
    <div className="check-info-overlay" onClick={onCancel}>
      <div className="compare-assign-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="compare-assign-title">Compare files</h3>
        <p className="compare-assign-desc">
          Is <strong>{shortName}</strong> the old or the new file?
        </p>
        <div className="compare-assign-buttons">
          <button className="compare-assign-btn compare-assign-a" onClick={() => onAssign('A')}>
            <span className="compare-assign-slot">A</span>
            <span className="compare-assign-slot-label">Old file</span>
          </button>
          <button className="compare-assign-btn compare-assign-b" onClick={() => onAssign('B')}>
            <span className="compare-assign-slot">B</span>
            <span className="compare-assign-slot-label">New file</span>
          </button>
        </div>
        <button className="check-info-close" onClick={onCancel}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}
