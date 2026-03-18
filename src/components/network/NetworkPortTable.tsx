import type { NetworkPortTableRowModel } from '../../network/networkUi';
import VirtualList from './VirtualList';

interface NetworkPortTableProps {
  rows: NetworkPortTableRowModel[];
  selectedPortKey: string | null;
  onSelectRow: (portKey: string) => void;
}

export default function NetworkPortTable({
  rows,
  selectedPortKey,
  onSelectRow,
}: NetworkPortTableProps): JSX.Element {
  return (
    <div className="network-table-wrap">
      <div className="network-table-head">
        <span>IED</span>
        <span>Device</span>
        <span>Bay/LD</span>
        <span>GOOSE</span>
        <span>SV</span>
        <span>REPORT</span>
        <span>Unresolved</span>
        <span>Health</span>
      </div>
      <VirtualList
        items={rows}
        rowHeight={44}
        height={360}
        className="network-table-body"
        itemKey={(row) => row.key}
        renderRow={(row) => (
          <NetworkPortTableRow
            row={row}
            selected={selectedPortKey === row.key}
            onClick={() => onSelectRow(row.key)}
          />
        )}
      />
    </div>
  );
}

export function NetworkPortTableRow({
  row,
  selected,
  onClick,
}: {
  row: NetworkPortTableRowModel;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button className={`network-row ${selected ? 'active' : ''}`} onClick={onClick}>
      <span>
        <strong>{row.iedName}</strong>
        <small>{row.apName}</small>
      </span>
      <span>
        <b className="badge neutral">{row.deviceType}</b>
      </span>
      <span>
        <strong className="truncate" title={row.bayLabel}>{row.bayLabel}</strong>
        <small className="truncate" title={row.ldeviceLabel}>{row.ldeviceLabel}</small>
      </span>
      <span className="metric-cell">
        <b className="badge">o:{row.gooseOut}</b>
        <b className="badge">i:{row.gooseIn}</b>
      </span>
      <span className="metric-cell">
        <b className="badge">o:{row.svOut}</b>
        <b className="badge">i:{row.svIn}</b>
      </span>
      <span className="metric-cell">
        <b className="badge">o:{row.reportOut}</b>
        <b className="badge">i:{row.reportIn}</b>
      </span>
      <span>
        <b className={`badge ${row.unresolvedCount > 0 ? 'danger' : ''}`}>{row.unresolvedCount}</b>
      </span>
      <span>
        <b className={`badge health-${row.health}`}>{row.health === 'resolved' ? 'ok' : row.health === 'probable' ? 'prob' : '!'}</b>
      </span>
    </button>
  );
}
