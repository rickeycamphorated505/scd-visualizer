import type { SclModel } from '../model/types';

export interface SummaryStats {
  ieds: number;
  logicalNodes: number;
  goose: number;
  smv: number;
  datasets: number;
  ips: number;
  macs: number;
  vlans: number;
  appIds: number;
}

export interface SystemStats {
  substations: number;
  voltageLevels: number;
  bays: number;
  ieds: number;
  accessPoints: number;
  lDevices: number;
  logicalNodes: number;
}

export interface NetworkStats {
  communicationNetworks: number;
  connectedAps: number;
  uniqueIps: number;
  uniqueMacs: number;
  uniqueVlanIds: number;
  uniqueAppIds: number;
  apsWithNetworkInfo: number;
  apsWithoutNetworkInfo: number;
}

export interface GooseStats {
  controlBlocks: number;
  publishers: number;
  subscribers: number;
  messages: number;
  /** Hámarksfjöldi GOOSE (útgefendur/signals) á einn IED */
  maxPerIed: number;
  /** IED nöfn sem hafa þetta hámark */
  maxPerIedIedNames: string[];
  byIed: Record<string, number>;
  byVlan: Record<string, number>;
  byAppId: Record<string, number>;
}

export interface SmvStats {
  controlBlocks: number;
  publishers: number;
  subscribers: number;
  /** Hámarksfjöldi SMV (útgefendur/signals) á einn IED */
  maxPerIed: number;
  /** IED nöfn sem hafa þetta hámark */
  maxPerIedIedNames: string[];
  byIed: Record<string, number>;
  byVlan: Record<string, number>;
  byAppId: Record<string, number>;
}

export interface DatasetStats {
  totalDatasets: number;
  totalEntries: number;
  perIed: Record<string, number>;
  minCount: number;
  maxCount: number;
  avgPerDataset: number;
}

export interface SignalsStats {
  dataObjects: number;
  dataAttributes: number;
  totalSignalsOrRefs: number;
  gooseSignals: number;
  smvSignals: number;
}

export interface ScdStatistics {
  summary: SummaryStats;
  system: SystemStats;
  network: NetworkStats;
  goose: GooseStats;
  smv: SmvStats;
  datasets: DatasetStats;
  signals: SignalsStats;
  lists: {
    ips: string[];
    macs: string[];
    vlanIds: string[];
    appIds: string[];
    datasetNames: string[];
    iedNames: string[];
  };
}

function collectUnique<T>(...arrays: (T[] | undefined)[]): T[] {
  const set = new Set<T>();
  for (const arr of arrays) {
    if (arr) {
      for (const v of arr) {
        if (v != null && v !== '') set.add(v);
      }
    }
  }
  return Array.from(set).sort();
}

export function computeScdStatistics(model: SclModel | undefined): ScdStatistics | null {
  if (!model) return null;

  const { ieds, bays, subNetworks, gseControls, svControls, dataSets, edges, gseComms, smvComms, extRefs } = model;

  const substationSet = new Set(bays.map((b) => b.substationName).filter(Boolean));
  const voltageLevelSet = new Set(bays.map((b) => b.voltageLevelName).filter(Boolean));

  let logicalNodeCount = 0;
  for (const ied of ieds) {
    for (const ld of ied.lDevices) {
      if (ld.ln0) logicalNodeCount += 1;
      logicalNodeCount += ld.lns.length;
    }
  }

  const allIps = collectUnique<string>(
    subNetworks.flatMap((s) => s.connectedAps.map((c) => c.ip).filter(Boolean)) as string[],
    ieds.flatMap((i) => i.accessPoints.map((a) => a.ip).filter(Boolean)) as string[],
  );
  const allMacs = collectUnique<string>(
    gseComms.map((c) => c.mac).filter(Boolean) as string[],
    smvComms.map((c) => c.mac).filter(Boolean) as string[],
    ieds.flatMap((i) => i.accessPoints.map((a) => a.mac).filter(Boolean)) as string[],
  );
  const allVlanIds = collectUnique<string>(
    gseComms.map((c) => c.vlanId).filter(Boolean) as string[],
    smvComms.map((c) => c.vlanId).filter(Boolean) as string[],
  );
  const allAppIds = collectUnique<string>(
    gseComms.map((c) => c.appId).filter(Boolean) as string[],
    smvComms.map((c) => c.appId).filter(Boolean) as string[],
  );

  const gooseEdges = edges.filter((e) => e.signalType === 'GOOSE');
  const smvEdges = edges.filter((e) => e.signalType === 'SV');
  const goosePublishers = new Set(gooseEdges.map((e) => e.publisherIed)).size;
  const gooseSubscribers = new Set(gooseEdges.flatMap((e) => [e.subscriberIed])).size;
  const smvPublishers = new Set(smvEdges.map((e) => e.publisherIed)).size;
  const smvSubscribers = new Set(smvEdges.flatMap((e) => [e.subscriberIed])).size;

  const gooseByIed: Record<string, number> = {};
  for (const e of gooseEdges) {
    gooseByIed[e.publisherIed] = (gooseByIed[e.publisherIed] || 0) + 1;
  }
  const gooseByVlan: Record<string, number> = {};
  for (const c of gseComms) {
    const v = c.vlanId || '(none)';
    gooseByVlan[v] = (gooseByVlan[v] || 0) + 1;
  }
  const gooseByAppId: Record<string, number> = {};
  for (const c of gseComms) {
    const a = c.appId || '(none)';
    gooseByAppId[a] = (gooseByAppId[a] || 0) + 1;
  }
  const gooseMaxPerIed = Object.keys(gooseByIed).length === 0 ? 0 : Math.max(...Object.values(gooseByIed));
  const gooseMaxPerIedIedNames = Object.entries(gooseByIed)
    .filter(([, n]) => n === gooseMaxPerIed)
    .map(([ied]) => ied)
    .sort();

  const smvByIed: Record<string, number> = {};
  for (const e of smvEdges) {
    smvByIed[e.publisherIed] = (smvByIed[e.publisherIed] || 0) + 1;
  }
  const smvByVlan: Record<string, number> = {};
  for (const c of smvComms) {
    const v = c.vlanId || '(none)';
    smvByVlan[v] = (smvByVlan[v] || 0) + 1;
  }
  const smvByAppId: Record<string, number> = {};
  for (const c of smvComms) {
    const a = c.appId || '(none)';
    smvByAppId[a] = (smvByAppId[a] || 0) + 1;
  }
  const smvMaxPerIed = Object.keys(smvByIed).length === 0 ? 0 : Math.max(...Object.values(smvByIed));
  const smvMaxPerIedIedNames = Object.entries(smvByIed)
    .filter(([, n]) => n === smvMaxPerIed)
    .map(([ied]) => ied)
    .sort();

  const datasetPerIed: Record<string, number> = {};
  let totalEntries = 0;
  for (const ds of dataSets) {
    datasetPerIed[ds.iedName] = (datasetPerIed[ds.iedName] || 0) + 1;
    totalEntries += ds.fcdas?.length ?? 0;
  }
  const entryCounts = dataSets.map((ds) => ds.fcdas?.length ?? 0).filter((n) => n > 0);
  const minCount = entryCounts.length === 0 ? 0 : Math.min(...entryCounts);
  const maxCount = entryCounts.length === 0 ? 0 : Math.max(...entryCounts);
  const avgPerDataset = dataSets.length === 0 ? 0 : totalEntries / dataSets.length;

  const gooseSignals = edges.filter((e) => e.signalType === 'GOOSE').reduce((s, e) => s + (e.fcdas?.length ?? 0), 0);
  const smvSignals = edges.filter((e) => e.signalType === 'SV').reduce((s, e) => s + (e.fcdas?.length ?? 0), 0);

  // Compute dataObjects and dataAttributes from dataTypeTemplates
  const dataObjects = model.dataTypeTemplates?.doTypes.size ?? 0;
  const dataAttributes = model.dataTypeTemplates
    ? Array.from(model.dataTypeTemplates.doTypes.values()).reduce((sum, dt) => sum + dt.das.length, 0)
      + Array.from(model.dataTypeTemplates.daTypes.values()).reduce((sum, dt) => sum + dt.bdas.length, 0)
    : 0;

  let connectedApsCount = 0;
  let apsWithNetwork = 0;
  let apsWithoutNetwork = 0;
  for (const s of subNetworks) {
    for (const cap of s.connectedAps) {
      connectedApsCount += 1;
      if (cap.ip || cap.physConns?.some((p) => /IP|MAC|VLAN|APPID/i.test(p.pType || ''))) {
        apsWithNetwork += 1;
      } else {
        apsWithoutNetwork += 1;
      }
    }
  }

  return {
    summary: {
      ieds: ieds.length,
      logicalNodes: logicalNodeCount,
      goose: gseControls.length,
      smv: svControls.length,
      datasets: dataSets.length,
      ips: allIps.length,
      macs: allMacs.length,
      vlans: allVlanIds.length,
      appIds: allAppIds.length,
    },
    system: {
      substations: substationSet.size,
      voltageLevels: voltageLevelSet.size,
      bays: bays.length,
      ieds: ieds.length,
      accessPoints: ieds.reduce((s, i) => s + i.accessPoints.length, 0),
      lDevices: ieds.reduce((s, i) => s + i.lDevices.length, 0),
      logicalNodes: logicalNodeCount,
    },
    network: {
      communicationNetworks: subNetworks.length,
      connectedAps: connectedApsCount,
      uniqueIps: allIps.length,
      uniqueMacs: allMacs.length,
      uniqueVlanIds: allVlanIds.length,
      uniqueAppIds: allAppIds.length,
      apsWithNetworkInfo: apsWithNetwork,
      apsWithoutNetworkInfo: apsWithoutNetwork,
    },
    goose: {
      controlBlocks: gseControls.length,
      publishers: goosePublishers,
      subscribers: gooseSubscribers,
      messages: gooseEdges.length,
      maxPerIed: gooseMaxPerIed,
      maxPerIedIedNames: gooseMaxPerIedIedNames,
      byIed: gooseByIed,
      byVlan: gooseByVlan,
      byAppId: gooseByAppId,
    },
    smv: {
      controlBlocks: svControls.length,
      publishers: smvPublishers,
      subscribers: smvSubscribers,
      maxPerIed: smvMaxPerIed,
      maxPerIedIedNames: smvMaxPerIedIedNames,
      byIed: smvByIed,
      byVlan: smvByVlan,
      byAppId: smvByAppId,
    },
    datasets: {
      totalDatasets: dataSets.length,
      totalEntries,
      perIed: datasetPerIed,
      minCount,
      maxCount,
      avgPerDataset: Math.round(avgPerDataset * 10) / 10,
    },
    signals: {
      dataObjects,
      dataAttributes,
      totalSignalsOrRefs: extRefs.length,
      gooseSignals,
      smvSignals,
    },
    lists: {
      ips: allIps,
      macs: allMacs,
      vlanIds: allVlanIds,
      appIds: allAppIds,
      datasetNames: dataSets.map((d) => `${d.iedName} / ${d.name}`).sort(),
      iedNames: ieds.map((i) => i.name).sort(),
    },
  };
}
