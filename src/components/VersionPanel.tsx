import type { SclHeaderModel } from '../model/types';

interface VersionPanelProps {
  header?: SclHeaderModel;
  fileName?: string;
  fileType?: string;
}

export default function VersionPanel({ header, fileName, fileType }: VersionPanelProps): JSX.Element {
  if (!header) {
    return (
      <div className="version-panel">
        <div className="version-panel-empty">
          <p className="hint">No header information in this file.</p>
        </div>
      </div>
    );
  }

  const currentVersion = header.version;
  const currentRevision = header.revision;

  return (
    <div className="version-panel">
      {/* Header info card */}
      <div className="version-header-card">
        <div className="version-header-row">
          <span className="version-header-label">File</span>
          <span className="version-header-value">{fileName ?? '—'}</span>
          {fileType && <span className="version-file-type-chip">{fileType}</span>}
          {header.helinksLocked ? (
            <span className="version-lock-badge version-lock-badge-locked" title="Helinks-managed file — edit only in Helinks STS">🔒 Locked (Helinks)</span>
          ) : (
            <span className="version-lock-badge" title="No Helinks lock detected">🔓 Not locked</span>
          )}
        </div>
        <div className="version-header-row">
          <span className="version-header-label">ID</span>
          <span className="version-header-value">{header.id ?? '—'}</span>
        </div>
        <div className="version-header-row">
          <span className="version-header-label">Version</span>
          <span className="version-header-value version-current">{currentVersion ?? '—'}</span>
        </div>
        <div className="version-header-row">
          <span className="version-header-label">Revision</span>
          <span className="version-header-value version-current">{currentRevision ?? '—'}</span>
        </div>
        {header.toolID && (
          <div className="version-header-row">
            <span className="version-header-label">Tool</span>
            <span className="version-header-value">{header.toolID}</span>
          </div>
        )}
        {header.nameStructure && (
          <div className="version-header-row">
            <span className="version-header-label">Name structure</span>
            <span className="version-header-value">{header.nameStructure}</span>
          </div>
        )}
      </div>

      {/* History table */}
      {header.history.length > 0 && (
        <div className="version-history">
          <div className="version-history-title">
            History
            <span className="version-history-count">{header.history.length} entries</span>
          </div>
          <div className="version-history-table-wrap">
            <table className="version-history-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Version</th>
                  <th>Revision</th>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {[...header.history].reverse().map((item, i) => {
                  const isLatest =
                    i === 0 &&
                    item.version === currentVersion &&
                    item.revision === currentRevision;
                  return (
                    <tr
                      key={header.history.length - 1 - i}
                      className={isLatest ? 'version-row-latest' : ''}
                    >
                      <td className="version-col-n">{header.history.length - i}</td>
                      <td className="version-col-ver">{item.version ?? ''}</td>
                      <td className="version-col-rev">{item.revision ?? ''}</td>
                      <td className="version-col-when">{item.when ?? ''}</td>
                      <td className="version-col-who">{item.who ?? ''}</td>
                      <td className="version-col-what">{item.what ?? ''}</td>
                      <td className="version-col-why">{item.why ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
