import type { SclModel } from '../model/types';
import type { PortFlowItem, PortTrafficSummary, TrafficProtocol } from './types';

export type RowHealth = 'resolved' | 'probable' | 'unresolved';
export type DeviceTypeFilter = 'all' | 'F' | 'S1' | 'P1';

export interface TableQuickFilters {
  search: string;
  unresolvedOnly: boolean;
  deviceType: DeviceTypeFilter;
  protocolFilter: Record<TrafficProtocol, boolean>;
  resolutionFilter: Record<RowHealth, boolean>;
}

export interface NetworkPortTableRowModel {
  key: string;
  iedName: string;
  apName: string;
  bayLabel: string;
  ldeviceLabel: string;
  deviceType: string;
  gooseOut: number;
  gooseIn: number;
  svOut: number;
  svIn: number;
  reportOut: number;
  reportIn: number;
  unresolvedCount: number;
  probableCount: number;
  resolvedCount: number;
  totalTraffic: number;
  health: RowHealth;
}

export function defaultTableQuickFilters(): TableQuickFilters {
  return {
    search: '',
    unresolvedOnly: false,
    deviceType: 'all',
    protocolFilter: {
      GOOSE: true,
      SV: true,
      REPORT: true,
    },
    resolutionFilter: {
      resolved: true,
      probable: true,
      unresolved: true,
    },
  };
}

export function buildPortTableRows(
  model: SclModel,
  ports: PortTrafficSummary[],
  quick: TableQuickFilters,
): NetworkPortTableRowModel[] {
  const rows = ports
    .map((port) => summarizePortRow(model, port, quick))
    .filter((row) => row.totalTraffic > 0 || !quick.unresolvedOnly)
    .filter((row) => {
      if (quick.unresolvedOnly && row.unresolvedCount <= 0) {
        return false;
      }
      if (quick.deviceType !== 'all' && row.deviceType !== quick.deviceType) {
        return false;
      }
      const q = quick.search.trim().toLowerCase();
      if (!q) {
        return true;
      }
      return row.iedName.toLowerCase().includes(q);
    });

  rows.sort((a, b) => {
    if (b.unresolvedCount !== a.unresolvedCount) {
      return b.unresolvedCount - a.unresolvedCount;
    }
    if (b.totalTraffic !== a.totalTraffic) {
      return b.totalTraffic - a.totalTraffic;
    }
    return a.iedName.localeCompare(b.iedName);
  });
  return rows;
}

export function filterProtocolItems(
  items: PortFlowItem[],
  protocol: TrafficProtocol,
  resolutionFilter: Record<RowHealth, boolean>,
): PortFlowItem[] {
  return items.filter((item) => item.protocol === protocol && resolutionFilter[item.status]);
}

export function unresolvedItems(items: PortFlowItem[]): PortFlowItem[] {
  return items.filter((item) => item.status !== 'resolved');
}

function summarizePortRow(
  model: SclModel,
  port: PortTrafficSummary,
  quick: TableQuickFilters,
): NetworkPortTableRowModel {
  const ied = model.ieds.find((item) => item.name === port.iedName);
  const bayLabel = ied?.bayNames.join(', ') || '-';
  const ldeviceLabel = ied?.lDevices.map((ld) => ld.inst).join(', ') || '-';
  const deviceType = inferDeviceType(port.iedName);

  const items = port.filteredFlowItems.filter((item) => quick.protocolFilter[item.protocol] && quick.resolutionFilter[item.status]);
  let gooseOut = 0;
  let gooseIn = 0;
  let svOut = 0;
  let svIn = 0;
  let reportOut = 0;
  let reportIn = 0;
  let unresolvedCount = 0;
  let probableCount = 0;
  let resolvedCount = 0;

  for (const item of items) {
    if (item.protocol === 'GOOSE') {
      if (item.direction === 'out') {
        gooseOut += 1;
      } else {
        gooseIn += 1;
      }
    } else if (item.protocol === 'SV') {
      if (item.direction === 'out') {
        svOut += 1;
      } else {
        svIn += 1;
      }
    } else if (item.protocol === 'REPORT') {
      if (item.direction === 'out') {
        reportOut += 1;
      } else {
        reportIn += 1;
      }
    }

    if (item.status === 'resolved') {
      resolvedCount += 1;
    } else if (item.status === 'probable') {
      probableCount += 1;
    } else {
      unresolvedCount += 1;
    }
  }

  const totalTraffic = gooseOut + gooseIn + svOut + svIn + reportOut + reportIn;
  const health: RowHealth =
    unresolvedCount > 0 ? 'unresolved' : probableCount > 0 ? 'probable' : 'resolved';

  return {
    key: port.key,
    iedName: port.iedName,
    apName: port.apName,
    bayLabel,
    ldeviceLabel,
    deviceType,
    gooseOut,
    gooseIn,
    svOut,
    svIn,
    reportOut,
    reportIn,
    unresolvedCount,
    probableCount,
    resolvedCount,
    totalTraffic,
    health,
  };
}

function inferDeviceType(iedName: string): string {
  const upper = iedName.toUpperCase();
  if (upper.startsWith('S1') || upper.includes('_S1') || upper.includes('-S1')) {
    return 'S1';
  }
  if (upper.startsWith('P1') || upper.includes('_P1') || upper.includes('-P1')) {
    return 'P1';
  }
  if (upper.startsWith('F') || upper.includes('_F') || upper.includes('-F')) {
    return 'F';
  }
  return 'Other';
}
