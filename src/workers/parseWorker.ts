import { parseSclDocument } from '../parser/sclParser';
import type { SclModel } from '../model/types';

// Serialized form of SclModel for postMessage (Maps converted to arrays)
export interface SerializedSclModel {
  ieds: SclModel['ieds'];
  bays: SclModel['bays'];
  substations: SclModel['substations'];
  subNetworks: SclModel['subNetworks'];
  gseControls: SclModel['gseControls'];
  svControls: SclModel['svControls'];
  reportControls: SclModel['reportControls'];
  dataSets: SclModel['dataSets'];
  extRefs: SclModel['extRefs'];
  gseComms: SclModel['gseComms'];
  smvComms: SclModel['smvComms'];
  edges: SclModel['edges'];
  snippets: SclModel['snippets'];
  dataTypeTemplates?: {
    lNodeTypes: Array<[string, { id: string; lnClass?: string; dos: { name: string; type: string }[] }]>;
    doTypes: Array<[string, { id: string; das: { name: string; fc?: string }[] }]>;
    daTypes: Array<[string, { id: string; bType?: string; bdas: { name: string; bType?: string }[] }]>;
    enumTypes: Array<[string, { id: string; enumValCount: number }]>;
    duplicateTypeIds: string[];
  };
  header?: SclModel['header'];
  sld?: SclModel['sld'];
}

function serializeModel(model: SclModel): SerializedSclModel {
  return {
    ieds: model.ieds,
    bays: model.bays,
    substations: model.substations,
    subNetworks: model.subNetworks,
    gseControls: model.gseControls,
    svControls: model.svControls,
    reportControls: model.reportControls,
    dataSets: model.dataSets,
    extRefs: model.extRefs,
    gseComms: model.gseComms,
    smvComms: model.smvComms,
    edges: model.edges,
    snippets: model.snippets,
    header: model.header,
    sld: model.sld,
    dataTypeTemplates: model.dataTypeTemplates ? {
      lNodeTypes: Array.from(model.dataTypeTemplates.lNodeTypes.entries()),
      doTypes: Array.from(model.dataTypeTemplates.doTypes.entries()),
      daTypes: Array.from(model.dataTypeTemplates.daTypes.entries()),
      enumTypes: Array.from(model.dataTypeTemplates.enumTypes.entries()),
      duplicateTypeIds: model.dataTypeTemplates.duplicateTypeIds,
    } : undefined,
  };
}

export function deserializeModel(raw: SerializedSclModel): SclModel {
  return {
    ieds: raw.ieds,
    bays: raw.bays,
    substations: raw.substations,
    subNetworks: raw.subNetworks,
    gseControls: raw.gseControls,
    svControls: raw.svControls,
    reportControls: raw.reportControls,
    dataSets: raw.dataSets,
    extRefs: raw.extRefs,
    gseComms: raw.gseComms,
    smvComms: raw.smvComms,
    edges: raw.edges,
    snippets: raw.snippets,
    header: raw.header,
    sld: raw.sld,
    dataTypeTemplates: raw.dataTypeTemplates ? {
      lNodeTypes: new Map(raw.dataTypeTemplates.lNodeTypes),
      doTypes: new Map(raw.dataTypeTemplates.doTypes),
      daTypes: new Map(raw.dataTypeTemplates.daTypes),
      enumTypes: new Map(raw.dataTypeTemplates.enumTypes ?? []),
      duplicateTypeIds: raw.dataTypeTemplates.duplicateTypeIds ?? [],
    } : undefined,
  };
}

self.addEventListener('message', (event: MessageEvent<{ type: 'parse'; xml: string; name: string }>) => {
  if (event.data.type !== 'parse') return;

  const { xml, name } = event.data;

  try {
    const result = parseSclDocument(xml, (stage, count) => {
      if (stage === 'ieds') {
        self.postMessage({ type: 'progress', ieds: count ?? 0 });
      }
    });

    if (result.error) {
      self.postMessage({ type: 'error', message: result.error.message, error: result.error });
      return;
    }

    if (!result.model) {
      self.postMessage({ type: 'error', message: 'Parse returned no model', error: { message: 'No model' } });
      return;
    }

    const serialized = serializeModel(result.model);
    self.postMessage({ type: 'result', result: { model: serialized, name } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    self.postMessage({ type: 'error', message });
  }
});
