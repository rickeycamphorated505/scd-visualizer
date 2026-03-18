import { Badge, Button, Tabs } from './ui';

interface CompareBarProps {
  mode: 'single' | 'compare';
  baselineName: string;
  newName: string;
  onModeChange: (mode: 'single' | 'compare') => void;
  onLoadBaseline: () => void;
  onLoadNew: () => void;
  showOnlyChanges: boolean;
  onToggleShowOnlyChanges: (value: boolean) => void;
}

export default function CompareBar({
  mode,
  baselineName,
  newName,
  onModeChange,
  onLoadBaseline,
  onLoadNew,
  showOnlyChanges,
  onToggleShowOnlyChanges,
}: CompareBarProps): JSX.Element {
  return (
    <section className="compare-bar">
      <Tabs<'single' | 'compare'>
        aria-label="Compare mode"
        value={mode}
        onChange={onModeChange}
        items={[
          { value: 'single', label: 'Single' },
          { value: 'compare', label: 'Compare' },
        ]}
      />

      {mode === 'compare' ? (
        <div className="compare-controls">
          <Button onClick={onLoadBaseline}>Load Baseline (A)</Button>
          <Badge>A: {baselineName || 'none'}</Badge>
          <Button onClick={onLoadNew}>Load New (B)</Button>
          <Badge>B: {newName || 'none'}</Badge>
          <span className="compare-label">A vs B</span>
          <label className="toggle-check">
            <input
              type="checkbox"
              checked={showOnlyChanges}
              onChange={(e) => onToggleShowOnlyChanges(e.target.checked)}
            />
            Show only changes
          </label>
        </div>
      ) : null}
    </section>
  );
}
