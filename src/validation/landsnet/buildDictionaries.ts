import type { DataSetModel, FcdaModel, GseCommModel, SclModel, SmvCommModel } from '../../model/types';
import type { LandsnetDatasetSignals, LandsnetDictionaries, LandsnetGooseControl, LandsnetMmsControl, LandsnetSvControl } from './types';

export function buildLandsnetDictionaries(model: SclModel): LandsnetDictionaries {
  const connectedApIndex = buildConnectedApIndex(model);

  const IED_dict: LandsnetDictionaries['IED_dict'] = {};
  for (const ied of model.ieds) {
    IED_dict[ied.name] = {
      accessPoints: ied.accessPoints.map((ap) => {
        const cap = connectedApIndex.get(`${ied.name}:${ap.name}`);
        return {
          apName: ap.name,
          subNetwork: cap?.subNetwork,
          ip: cap?.ip || ap.ip,
          netmask: cap?.netmask,
          gateway: cap?.gateway,
          mac: cap?.mac || ap.mac,
        };
      }),
    };
  }

  const MMS_dict: LandsnetDictionaries['MMS_dict'] = {};
  const MMS_dataset_dict: LandsnetDictionaries['MMS_dataset_dict'] = {};
  for (const ctrl of model.reportControls) {
    const list = ensureArray(MMS_dict, ctrl.iedName);
    const entry: LandsnetMmsControl = {
      reportControl: ctrl.name,
      rptId: ctrl.rptId,
      dataset: ctrl.datSet,
      confRev: ctrl.confRev,
      indexed: ctrl.indexed,
    };
    list.push(entry);

    const dataset = findDatasetForControl(model.dataSets, ctrl.iedName, ctrl.datSet, ctrl.ldInst);
    if (dataset) {
      const dsList = ensureArray(MMS_dataset_dict, ctrl.iedName);
      dsList.push({
        ownerControl: ctrl.name,
        dataset: dataset.name,
        signals: dataset.fcdas.map((fcda) => formatSignal(ctrl.iedName, fcda, false)),
      });
    }
  }

  const GOOSE_dict: LandsnetDictionaries['GOOSE_dict'] = {};
  const GOOSE_dataset_dict: LandsnetDictionaries['GOOSE_dataset_dict'] = {};
  for (const ctrl of model.gseControls) {
    const comm = findGooseComm(model.gseComms, ctrl.iedName, ctrl.apName, ctrl.ldInst, ctrl.name);
    const subscribers = unique(
      model.edges
        .filter((edge) => edge.signalType === 'GOOSE' && edge.publisherIed === ctrl.iedName && edge.controlBlockName === ctrl.name)
        .map((edge) => edge.subscriberIed),
    );

    const list = ensureArray(GOOSE_dict, ctrl.iedName);
    const entry: LandsnetGooseControl = {
      controlBlockName: ctrl.name,
      dataset: ctrl.datSet,
      confRev: ctrl.confRev,
      mac: comm?.mac,
      appid: comm?.appId || ctrl.appId,
      vlanId: comm?.vlanId,
      vlanPriority: comm?.vlanPriority,
      minTime: comm?.minTime,
      maxTime: comm?.maxTime,
      subscribers,
    };
    list.push(entry);

    const dataset = findDatasetForControl(model.dataSets, ctrl.iedName, ctrl.datSet, ctrl.ldInst);
    if (dataset) {
      const dsList = ensureArray(GOOSE_dataset_dict, ctrl.iedName);
      dsList.push({
        ownerControl: ctrl.name,
        dataset: dataset.name,
        signals: dataset.fcdas.map((fcda) => formatSignal(ctrl.iedName, fcda, true)),
      });
    }
  }

  const SV_dict: LandsnetDictionaries['SV_dict'] = {};
  const SV_dataset_dict: LandsnetDictionaries['SV_dataset_dict'] = {};
  for (const ctrl of model.svControls) {
    const comm = findSvComm(model.smvComms, ctrl.iedName, ctrl.apName, ctrl.ldInst, ctrl.name);
    const subscribers = unique(
      model.edges
        .filter((edge) => edge.signalType === 'SV' && edge.publisherIed === ctrl.iedName && edge.controlBlockName === ctrl.name)
        .map((edge) => edge.subscriberIed),
    );

    const list = ensureArray(SV_dict, ctrl.iedName);
    const entry: LandsnetSvControl = {
      smvId: ctrl.smvId,
      controlBlockName: ctrl.name,
      dataset: ctrl.datSet,
      confRev: ctrl.confRev,
      mac: comm?.mac,
      appid: comm?.appId,
      vlanId: comm?.vlanId,
      vlanPriority: comm?.vlanPriority,
      subscribers,
    };
    list.push(entry);

    const dataset = findDatasetForControl(model.dataSets, ctrl.iedName, ctrl.datSet, ctrl.ldInst);
    if (dataset) {
      const dsList = ensureArray(SV_dataset_dict, ctrl.iedName);
      dsList.push({
        ownerControl: ctrl.name,
        dataset: dataset.name,
        signals: dataset.fcdas.map((fcda) => formatSignal(ctrl.iedName, fcda, true)),
      });
    }
  }

  sortDictionaryLists(MMS_dataset_dict);
  sortDictionaryLists(GOOSE_dataset_dict);
  sortDictionaryLists(SV_dataset_dict);

  return {
    IED_dict,
    MMS_dict,
    MMS_dataset_dict,
    GOOSE_dict,
    GOOSE_dataset_dict,
    SV_dict,
    SV_dataset_dict,
  };
}

function buildConnectedApIndex(model: SclModel): Map<string, { subNetwork: string; ip?: string; netmask?: string; gateway?: string; mac?: string }> {
  const index = new Map<string, { subNetwork: string; ip?: string; netmask?: string; gateway?: string; mac?: string }>();
  for (const subnet of model.subNetworks) {
    for (const cap of subnet.connectedAps) {
      const key = `${cap.iedName}:${cap.apName}`;
      const current = index.get(key);
      if (!current) {
        index.set(key, {
          subNetwork: subnet.name,
          ip: cap.ip,
          netmask: cap.netmask,
          gateway: cap.gateway,
          mac: selectPhys(cap.physConns, ['MAC', 'MAC-Address']),
        });
      }
    }
  }
  return index;
}

function findDatasetForControl(dataSets: DataSetModel[], iedName: string, datasetName?: string, ldInst?: string): DataSetModel | undefined {
  if (!datasetName) {
    return undefined;
  }
  return (
    dataSets.find((ds) => ds.iedName === iedName && ds.name === datasetName && (!ldInst || ds.ldInst === ldInst)) ||
    dataSets.find((ds) => ds.iedName === iedName && ds.name === datasetName)
  );
}

function findGooseComm(
  comms: GseCommModel[],
  iedName: string,
  apName: string | undefined,
  ldInst: string,
  cbName: string,
): GseCommModel | undefined {
  return (
    comms.find((comm) => comm.iedName === iedName && comm.cbName === cbName && (!apName || comm.apName === apName) && (!comm.ldInst || comm.ldInst === ldInst)) ||
    comms.find((comm) => comm.iedName === iedName && comm.cbName === cbName) ||
    comms.find((comm) => comm.iedName === iedName && (!apName || comm.apName === apName))
  );
}

function findSvComm(
  comms: SmvCommModel[],
  iedName: string,
  apName: string | undefined,
  ldInst: string,
  cbName: string,
): SmvCommModel | undefined {
  return (
    comms.find((comm) => comm.iedName === iedName && comm.cbName === cbName && (!apName || comm.apName === apName) && (!comm.ldInst || comm.ldInst === ldInst)) ||
    comms.find((comm) => comm.iedName === iedName && comm.cbName === cbName) ||
    comms.find((comm) => comm.iedName === iedName && (!apName || comm.apName === apName))
  );
}

function formatSignal(iedName: string, fcda: FcdaModel, includeDaName: boolean): string {
  const ldInst = fcda.ldInst || '';
  const ln = `${fcda.prefix || ''}${fcda.lnClass || ''}${fcda.lnInst || ''}`;
  const base = `${iedName}${ldInst}/${ln}.${fcda.doName || ''}`;
  if (!includeDaName) {
    return base;
  }
  const daName = fcda.daName || '';
  return `${base}.${daName}`;
}

function ensureArray<T>(dict: Record<string, T[]>, key: string): T[] {
  if (!dict[key]) {
    dict[key] = [];
  }
  return dict[key];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function selectPhys(values: Array<{ pType?: string; value: string }>, keys: string[]): string | undefined {
  const upper = keys.map((item) => item.toUpperCase());
  const hit = values.find((item) => upper.includes((item.pType || '').toUpperCase()));
  return hit?.value;
}

function sortDictionaryLists(dict: Record<string, LandsnetDatasetSignals[]>): void {
  for (const entries of Object.values(dict)) {
    entries.sort((a, b) => `${a.ownerControl || ''}:${a.dataset}`.localeCompare(`${b.ownerControl || ''}:${b.dataset}`));
  }
}
