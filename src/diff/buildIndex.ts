import type { SclModel } from '../model/types';
import type { EntityIndexItem } from './types';

export function buildEntityIndex(model: SclModel): EntityIndexItem[] {
  const items: EntityIndexItem[] = [];

  for (const ied of model.ieds) {
    items.push({
      key: `IED/${ied.name}`,
      comRef: readComRef(model.snippets[`ied:${ied.name}`]),
      entityType: 'IED',
      area: 'Generic',
      path: `/SCL/IED[@name='${ied.name}']`,
      iedName: ied.name,
      attrs: {
        name: ied.name,
        desc: ied.desc || '',
        bays: ied.bayNames.join(','),
      },
    });
  }

  for (const ds of model.dataSets) {
    const fcdaSignature = ds.fcdas
      .map((f) => `${f.ldInst}:${f.lnClass}:${f.lnInst}:${f.doName}:${f.daName}`)
      .sort((a, b) => a.localeCompare(b))
      .join('|');
    items.push({
      key: `IED/${ds.iedName}/LD/${ds.ldInst}/LN/${ds.lnClass}.${ds.lnInst || ''}/DataSet/${ds.name}`,
      comRef: readComRef(model.snippets[ds.key]),
      entityType: 'DataSet',
      area: 'Generic',
      path: `/SCL/IED[@name='${ds.iedName}']//DataSet[@name='${ds.name}']`,
      iedName: ds.iedName,
      attrs: {
        name: ds.name,
        fcdaCount: String(ds.fcdas.length),
        fcdaSignature,
      },
    });
  }

  for (const cb of [...model.gseControls, ...model.svControls, ...model.reportControls]) {
    items.push({
      key: `IED/${cb.iedName}/LD/${cb.ldInst}/LN/${cb.lnClass}.${cb.lnInst || ''}/${cb.type}/${cb.name}`,
      comRef: readComRef(model.snippets[cb.key]),
      entityType: 'ControlBlock',
      area: cb.type === 'GOOSE' ? 'GOOSE' : cb.type === 'SV' ? 'SV' : 'Reporting',
      path: `/SCL/IED[@name='${cb.iedName}']//${cb.type === 'SV' ? 'SMVControl|SVControl' : cb.type === 'GOOSE' ? 'GSEControl' : 'ReportControl'}[@name='${cb.name}']`,
      iedName: cb.iedName,
      attrs: {
        name: cb.name,
        type: cb.type,
        datSet: cb.datSet || '',
        confRev: cb.confRev || '',
        appId: 'appId' in cb ? cb.appId || '' : '',
        smvId: 'smvId' in cb ? cb.smvId || '' : '',
        rptId: 'rptId' in cb ? cb.rptId || '' : '',
      },
    });
  }

  for (const subnet of model.subNetworks) {
    for (const cap of subnet.connectedAps) {
      const gse = model.gseComms.filter((c) => c.iedName === cap.iedName && c.apName === cap.apName);
      const smv = model.smvComms.filter((c) => c.iedName === cap.iedName && c.apName === cap.apName);
      items.push({
        key: `IED/${cap.iedName}/AP/${cap.apName}/ConnectedAP`,
        comRef: readComRef(model.snippets[`connectedap:${subnet.name}:${cap.iedName}:${cap.apName}`]),
        entityType: 'ConnectedAP',
        area: 'Communication',
        path: `/SCL/Communication/SubNetwork[@name='${subnet.name}']/ConnectedAP[@iedName='${cap.iedName}' and @apName='${cap.apName}']`,
        iedName: cap.iedName,
        attrs: {
          iedName: cap.iedName,
          apName: cap.apName,
          subNetwork: subnet.name,
          ip: cap.ip || '',
          mac: cap.physConns.find((p) => (p.pType || '').toUpperCase().includes('MAC'))?.value || '',
          gseAppId: sortJoin(gse.map((c) => c.appId || '')),
          gseVlanId: sortJoin(gse.map((c) => c.vlanId || '')),
          gseMac: sortJoin(gse.map((c) => c.mac || '')),
          smvAppId: sortJoin(smv.map((c) => c.appId || '')),
          smvVlanId: sortJoin(smv.map((c) => c.vlanId || '')),
          smvMac: sortJoin(smv.map((c) => c.mac || '')),
        },
      });
    }
  }

  // Compare only confidently mapped flows to avoid large noise from inferred/probable links.
  for (const edge of model.edges.filter((item) => item.status === 'resolved')) {
    items.push({
      key: `FLOW/${edge.signalType}/${edge.publisherIed}/${edge.subscriberIed}/${edge.controlBlockName || ''}`,
      entityType: 'Flow',
      area: edge.signalType === 'GOOSE' ? 'GOOSE' : edge.signalType === 'SV' ? 'SV' : 'Reporting',
      path: `flow:${edge.key}`,
      iedName: edge.publisherIed,
      attrs: {
        signalType: edge.signalType,
        publisher: edge.publisherIed,
        subscriber: edge.subscriberIed,
        cbName: edge.controlBlockName || '',
        dataSet: edge.dataSetName || '',
      },
    });
  }

  return items;
}

function readComRef(snippet?: string): string | undefined {
  if (!snippet) {
    return undefined;
  }
  const m = snippet.match(/\bcomRef\s*=\s*"([^"]+)"/i);
  return m ? m[1] : undefined;
}

function sortJoin(values: string[]): string {
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}
