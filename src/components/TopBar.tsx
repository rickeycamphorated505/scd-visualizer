import { Badge } from './ui';

type ViewMode = 'visualizer' | 'network' | 'issues' | 'compare' | 'statistics' | 'addresses';

interface TopBarProps {
  fileName: string;
  appMode: ViewMode;
  issueCount: number;
  onOpenFile: () => void;
  onLoadExample: (path: string) => void;
  onOpenCommand: () => void;
  onExportGooseCsv: () => void;
  onExportGooseDetailedCsv: () => void;
  onExportAllFlowsCsv: () => void;
  onExportProtocolSummaryCsv: () => void;
  onExportLandsnetJson: () => void;
  onExportExcelIp: (sheetsOption?: import('../utils/exportExcel').ExportSheetsOption) => void;
  onSetAppMode: (mode: ViewMode) => void;
}

const EXAMPLES = [
  { label: 'Example 1 – Basic GOOSE/SV', path: '/examples/example-basic.scd' },
  { label: 'Example 2 – Unresolved links', path: '/examples/example-unresolved.scd' },
];

export default function TopBar({
  fileName,
  issueCount,
  onOpenFile,
  onLoadExample,
  onOpenCommand,
  onExportGooseCsv,
  onExportGooseDetailedCsv,
  onExportAllFlowsCsv,
  onExportProtocolSummaryCsv,
  onExportLandsnetJson,
  onExportExcelIp,
}: TopBarProps): JSX.Element {
  const hasFile = Boolean(fileName && fileName !== 'none');

  return (
    <header className="topbar-v2">
      <div className="topbar-left">
        <span className="topbar-logo">◆ SCD Visualizer V2</span>
      </div>

      <div className="topbar-center">
        {hasFile ? (
          <Badge variant="accent" title={fileName}>
            {fileName.length > 40 ? `…${fileName.slice(-37)}` : fileName}
          </Badge>
        ) : (
          <Badge variant="default">No file loaded</Badge>
        )}
        {issueCount > 0 ? (
          <Badge variant="warn">
            {issueCount} issue{issueCount !== 1 ? 's' : ''}
          </Badge>
        ) : hasFile ? (
          <Badge variant="success">All checks passed</Badge>
        ) : null}
      </div>

      <div className="topbar-actions">
        <button className="btn btn-primary topbar-load-btn" onClick={onOpenFile}>
          Load File
        </button>
        <select
          className="input topbar-example-select"
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (!value) return;
            onLoadExample(value);
            e.target.value = '';
          }}
        >
          <option value="" disabled>Examples</option>
          {EXAMPLES.map((example) => (
            <option key={example.path} value={example.path}>
              {example.label}
            </option>
          ))}
        </select>
        <details className="export-menu">
          <summary className="btn" title="Export options">
            Export ▾
          </summary>
          <div className="export-content" role="group" aria-label="Export options">
            <button className="menu-item" onClick={onExportGooseCsv}>GOOSE Matrix CSV</button>
            <button className="menu-item" onClick={onExportGooseDetailedCsv}>GOOSE Detailed CSV</button>
            <button className="menu-item" onClick={onExportAllFlowsCsv}>All Flows CSV</button>
            <button className="menu-item" onClick={onExportProtocolSummaryCsv}>Protocol Summary CSV</button>
            <button className="menu-item" onClick={() => onExportExcelIp('all')} title="All sheets">Excel: All sheets</button>
            <button className="menu-item" onClick={() => onExportExcelIp('ip_only')} title="IP sheet only">Excel: IP only</button>
            <button className="menu-item" onClick={() => onExportExcelIp('signals_only')} title="Signals sheets">Excel: Signals only</button>
            <button className="menu-item" onClick={onExportLandsnetJson}>Landsnet JSON</button>
          </div>
        </details>
        <button className="search-entry topbar-search" onClick={onOpenCommand}>
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
      </div>
    </header>
  );
}
