import { describe, expect, it } from 'vitest';
import type { SclModel } from '../model/types';
import type { PortFlowItem, PortTrafficSummary } from './types';
import { buildPortTableRows, defaultTableQuickFilters } from './networkUi';

function makeModel(): SclModel {
  return {
    ieds: [
      {
        name: 'F_LINE_01',
        desc: 'Feeder',
        accessPoints: [],
        lDevices: [{ inst: 'LD0', lns: [] }],
        bayNames: ['Bay_A'],
      },
      {
        name: 'S1_BUS_01',
        desc: 'Station',
        accessPoints: [],
        lDevices: [{ inst: 'LD1', lns: [] }],
        bayNames: ['Bay_B'],
      },
    ],
    bays: [],
    substations: [],
    subNetworks: [],
    gseControls: [],
    svControls: [],
    reportControls: [],
    dataSets: [],
    extRefs: [],
    gseComms: [],
    smvComms: [],
    edges: [],
    snippets: {},
  };
}

function makeItem(
  id: string,
  iedName: string,
  protocol: PortFlowItem['protocol'],
  direction: PortFlowItem['direction'],
  status: PortFlowItem['status'],
): PortFlowItem {
  return {
    id,
    edgeKey: id,
    protocol,
    direction,
    subNetwork: 'PROC',
    iedName,
    apName: 'P1',
    peerIed: 'PEER',
    sourceIed: direction === 'out' ? iedName : 'PEER',
    destinationIed: direction === 'in' ? iedName : 'PEER',
    controlBlockName: 'CB1',
    dataSetName: 'DS1',
    status,
  };
}

function makePort(
  key: string,
  iedName: string,
  items: PortFlowItem[],
): PortTrafficSummary {
  return {
    key,
    iedName,
    iedDesc: '',
    apName: 'P1',
    subNetwork: 'PROC',
    ip: '',
    mac: '',
    flowItems: items,
    filteredFlowItems: items,
    counts: {
      GOOSE: { in: 0, out: 0 },
      SV: { in: 0, out: 0 },
      REPORT: { in: 0, out: 0 },
      unresolved: 0,
      total: items.length,
    },
    filteredCounts: {
      GOOSE: { in: 0, out: 0 },
      SV: { in: 0, out: 0 },
      REPORT: { in: 0, out: 0 },
      unresolved: 0,
      total: items.length,
    },
  };
}

describe('networkUi table rows', () => {
  it('sorts by unresolved desc then total traffic desc', () => {
    const model = makeModel();
    const portA = makePort('F_LINE_01::P1', 'F_LINE_01', [
      makeItem('a1', 'F_LINE_01', 'GOOSE', 'out', 'unresolved'),
      makeItem('a2', 'F_LINE_01', 'SV', 'out', 'unresolved'),
      makeItem('a3', 'F_LINE_01', 'REPORT', 'out', 'resolved'),
    ]);
    const portB = makePort('S1_BUS_01::P1', 'S1_BUS_01', [
      makeItem('b1', 'S1_BUS_01', 'GOOSE', 'out', 'resolved'),
      makeItem('b2', 'S1_BUS_01', 'SV', 'out', 'resolved'),
      makeItem('b3', 'S1_BUS_01', 'REPORT', 'out', 'resolved'),
      makeItem('b4', 'S1_BUS_01', 'GOOSE', 'in', 'resolved'),
    ]);
    const rows = buildPortTableRows(model, [portB, portA], defaultTableQuickFilters());
    expect(rows[0].iedName).toBe('F_LINE_01');
    expect(rows[1].iedName).toBe('S1_BUS_01');
  });

  it('applies quick filters (device type/search/unresolved/protocol/resolution)', () => {
    const model = makeModel();
    const portA = makePort('F_LINE_01::P1', 'F_LINE_01', [
      makeItem('a1', 'F_LINE_01', 'GOOSE', 'out', 'probable'),
      makeItem('a2', 'F_LINE_01', 'SV', 'in', 'resolved'),
    ]);
    const portB = makePort('S1_BUS_01::P1', 'S1_BUS_01', [
      makeItem('b1', 'S1_BUS_01', 'REPORT', 'out', 'resolved'),
    ]);
    const quick = defaultTableQuickFilters();
    quick.deviceType = 'F';
    quick.search = 'line';
    quick.unresolvedOnly = false;
    quick.protocolFilter.SV = false;
    quick.protocolFilter.REPORT = false;
    quick.resolutionFilter.resolved = false;
    const rows = buildPortTableRows(model, [portA, portB], quick);
    expect(rows).toHaveLength(1);
    expect(rows[0].iedName).toBe('F_LINE_01');
    expect(rows[0].gooseOut).toBe(1);
    expect(rows[0].svIn).toBe(0);
  });
});
