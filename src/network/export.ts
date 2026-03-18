import type { NetworkPortFilterRow, NetworkPortSummaryRow } from './types';

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.split('"').join('""')}"`;
  }
  return value;
}

export function networkPortSummaryCsv(rows: NetworkPortSummaryRow[]): string {
  const headers = [
    'IED',
    'port',
    'SubNetwork',
    'IP',
    'MAC',
    'GOOSE_out_count',
    'GOOSE_in_count',
    'SV_out_count',
    'SV_in_count',
    'REPORT_out_count',
    'REPORT_in_count',
    'unresolved_count',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.ied,
        row.port,
        row.subNetwork,
        row.ip,
        row.mac,
        String(row.gooseOutCount),
        String(row.gooseInCount),
        String(row.svOutCount),
        String(row.svInCount),
        String(row.reportOutCount),
        String(row.reportInCount),
        String(row.unresolvedCount),
      ]
        .map(escapeCsv)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function networkPortFiltersCsv(rows: NetworkPortFilterRow[]): string {
  const headers = [
    'IED',
    'port',
    'SubNetwork',
    'protocol',
    'direction',
    'multicast_dst_mac',
    'vlan_id',
    'vlan_priority',
    'appid',
    'source',
    'destination',
    'control_block',
    'dataset',
    'status',
    'message',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.ied,
        row.port,
        row.subNetwork,
        row.protocol,
        row.direction,
        row.multicastDstMac,
        row.vlanId,
        row.vlanPriority,
        row.appId,
        row.source,
        row.destination,
        row.controlBlock,
        row.dataSet,
        row.status,
        row.message,
      ]
        .map(escapeCsv)
        .join(','),
    );
  }
  return lines.join('\n');
}
