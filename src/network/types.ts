import type { EdgeModel, SclModel } from '../model/types';

export type TrafficProtocol = 'GOOSE' | 'SV' | 'REPORT';
export type TrafficDirection = 'in' | 'out';
export type TrafficResolutionFilter = 'all' | 'resolved' | 'unresolved';

export interface NetworkTrafficFilters {
  protocolFilter: Record<TrafficProtocol, boolean>;
  direction: 'both' | TrafficDirection;
  resolution: TrafficResolutionFilter;
}

export interface FlowCounter {
  GOOSE: { in: number; out: number };
  SV: { in: number; out: number };
  REPORT: { in: number; out: number };
  unresolved: number;
  total: number;
}

export interface PortFlowItem {
  id: string;
  edgeKey: string;
  protocol: TrafficProtocol;
  direction: TrafficDirection;
  subNetwork: string;
  iedName: string;
  apName: string;
  peerIed: string;
  sourceIed: string;
  destinationIed: string;
  controlBlockName?: string;
  dataSetName?: string;
  status: EdgeModel['status'];
  message?: string;
  multicastDstMac?: string;
  vlanId?: string;
  vlanPriority?: string;
  appId?: string;
  ip?: string;
}

export interface PortTrafficSummary {
  key: string;
  iedName: string;
  iedDesc?: string;
  apName: string;
  subNetwork: string;
  ip?: string;
  mac?: string;
  flowItems: PortFlowItem[];
  filteredFlowItems: PortFlowItem[];
  counts: FlowCounter;
  filteredCounts: FlowCounter;
}

export interface NetworkSwitchNode {
  id: string;
  name: string;
  explicit: boolean;
  iedName?: string;
  apName?: string;
}

export interface PortTrafficLink {
  id: string;
  iedName: string;
  apName: string;
  portKey: string;
  subNetwork: string;
  switchId: string;
  flowItems: PortFlowItem[];
  filteredFlowItems: PortFlowItem[];
  counts: FlowCounter;
  filteredCounts: FlowCounter;
}

export interface NetworkTopologyView {
  selectedSubNetwork: string;
  subNetworks: string[];
  model: SclModel;
  switches: NetworkSwitchNode[];
  ports: PortTrafficSummary[];
  links: PortTrafficLink[];
}

export interface NetworkPortSummaryRow {
  ied: string;
  port: string;
  subNetwork: string;
  ip: string;
  mac: string;
  gooseOutCount: number;
  gooseInCount: number;
  svOutCount: number;
  svInCount: number;
  reportOutCount: number;
  reportInCount: number;
  unresolvedCount: number;
}

export interface NetworkPortFilterRow {
  ied: string;
  port: string;
  subNetwork: string;
  protocol: TrafficProtocol;
  direction: TrafficDirection;
  multicastDstMac: string;
  vlanId: string;
  vlanPriority: string;
  appId: string;
  source: string;
  destination: string;
  controlBlock: string;
  dataSet: string;
  status: string;
  message: string;
}
