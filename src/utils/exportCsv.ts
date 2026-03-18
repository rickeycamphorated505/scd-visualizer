import type { EdgeModel, SclModel } from '../model/types';
import type { Change } from '../diff/types';
import type { ValidationIssue } from '../validation/types';

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.split('"').join('""')}"`;
  }
  return value;
}

export function gooseMatrixCsv(edges: EdgeModel[]): string {
  const headers = ['Publisher IED', 'CB name', 'Dataset', 'Subscriber IED', 'Status'];
  const lines = [headers.join(',')];

  for (const edge of edges.filter((e) => e.signalType === 'GOOSE')) {
    lines.push(
      [
        edge.publisherIed,
        edge.controlBlockName || '',
        edge.dataSetName || '',
        edge.subscriberIed,
        edge.status,
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  return lines.join('\n');
}

export function detailedFlowsCsv(model: SclModel, protocol: 'GOOSE' | 'SV' | 'REPORT' | 'ALL' = 'ALL'): string {
  const headers = [
    'Protocol',
    'Publisher IED',
    'Publisher AP',
    'Subscriber IED',
    'Control Block',
    'DataSet',
    'Status',
    'Reason',
    'ConfRev',
    'SubNetwork',
    'IP',
    'MAC',
    'APPID',
    'VLAN-ID',
    'FCDA Count',
    'FCDA Items',
  ];
  const lines = [headers.join(',')];
  const edges =
    protocol === 'ALL' ? model.edges : model.edges.filter((edge) => edge.signalType === protocol);

  for (const edge of edges) {
    const control = findControl(model, edge);
    const comm = findComm(model, edge);
    const cap = findConnectedAp(model, edge.publisherIed, control?.apName);
    const subNetwork = findSubNetwork(model, edge.publisherIed, control?.apName);
    lines.push(
      [
        edge.signalType,
        edge.publisherIed,
        control?.apName || comm?.apName || '',
        edge.subscriberIed,
        edge.controlBlockName || '',
        edge.dataSetName || control?.datSet || '',
        edge.status,
        edge.reason || '',
        control?.confRev || '',
        subNetwork || '',
        cap?.ip || '',
        comm?.mac || cap?.mac || '',
        comm?.appId || '',
        comm?.vlanId || '',
        String(edge.fcdas.length),
        fcdaList(edge.fcdas),
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  return lines.join('\n');
}

export function protocolSummaryCsv(model: SclModel): string {
  const headers = ['Protocol', 'Flow Count', 'Resolved', 'Probable', 'Unresolved', 'Unique Publishers', 'Unique Subscribers'];
  const lines = [headers.join(',')];

  const protocols: Array<'GOOSE' | 'SV' | 'REPORT'> = ['GOOSE', 'SV', 'REPORT'];
  for (const protocol of protocols) {
    const edges = model.edges.filter((edge) => edge.signalType === protocol);
    const resolved = edges.filter((edge) => edge.status === 'resolved').length;
    const probable = edges.filter((edge) => edge.status === 'probable').length;
    const unresolved = edges.filter((edge) => edge.status === 'unresolved').length;
    const publishers = new Set(edges.map((edge) => edge.publisherIed));
    const subscribers = new Set(edges.map((edge) => edge.subscriberIed));
    lines.push(
      [
        protocol,
        String(edges.length),
        String(resolved),
        String(probable),
        String(unresolved),
        String(publishers.size),
        String(subscribers.size),
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  return lines.join('\n');
}

export function changesCsv(changes: Change[]): string {
  const headers = ['changeType', 'entityType', 'key/comRef', 'iedName', 'summary', 'field', 'before', 'after'];
  const lines = [headers.join(',')];
  for (const change of changes) {
    if (change.details.length === 0) {
      lines.push(
        [
          change.changeType,
          change.entityType,
          change.comRef || change.key,
          change.iedName || '',
          change.summary,
          '',
          '',
          '',
        ]
          .map(escapeCsv)
          .join(','),
      );
      continue;
    }
    for (const detail of change.details) {
      lines.push(
        [
          change.changeType,
          change.entityType,
          change.comRef || change.key,
          change.iedName || '',
          change.summary,
          detail.field,
          detail.before,
          detail.after,
        ]
          .map(escapeCsv)
          .join(','),
      );
    }
  }
  return lines.join('\n');
}

export function validationCsv(issues: ValidationIssue[]): string {
  const headers = ['severity', 'category', 'code', 'message', 'path', 'entityType', 'entityId', 'iedName', 'apName', 'ldInst', 'lnClass', 'lnInst', 'cbName', 'dataSet', 'appid', 'mac', 'ip', 'quickFix'];
  const lines = [headers.join(',')];
  for (const issue of issues) {
    lines.push(
      [
        issue.severity,
        issue.category,
        issue.code,
        issue.message,
        issue.path,
        issue.entityRef.type,
        issue.entityRef.id,
        issue.context.iedName || '',
        issue.context.apName || '',
        issue.context.ldInst || '',
        issue.context.lnClass || '',
        issue.context.lnInst || '',
        issue.context.cbName || '',
        issue.context.dataSet || '',
        issue.context.appid || '',
        issue.context.mac || '',
        issue.context.ip || '',
        issue.fixHint || issue.quickFix || '',
      ]
        .map(escapeCsv)
        .join(','),
    );
  }
  return lines.join('\n');
}

function findControl(model: SclModel, edge: EdgeModel) {
  if (!edge.controlBlockName) {
    return undefined;
  }
  if (edge.signalType === 'GOOSE') {
    return model.gseControls.find(
      (cb) => cb.iedName === edge.publisherIed && cb.name === edge.controlBlockName,
    );
  }
  if (edge.signalType === 'SV') {
    return model.svControls.find(
      (cb) => cb.iedName === edge.publisherIed && cb.name === edge.controlBlockName,
    );
  }
  return model.reportControls.find(
    (cb) => cb.iedName === edge.publisherIed && cb.name === edge.controlBlockName,
  );
}

function findComm(model: SclModel, edge: EdgeModel) {
  if (edge.signalType === 'GOOSE') {
    return (
      model.gseComms.find(
        (comm) =>
          comm.iedName === edge.publisherIed &&
          (!edge.controlBlockName || comm.cbName === edge.controlBlockName),
      ) ||
      model.gseComms.find((comm) => comm.iedName === edge.publisherIed)
    );
  }
  if (edge.signalType === 'SV') {
    return (
      model.smvComms.find(
        (comm) =>
          comm.iedName === edge.publisherIed &&
          (!edge.controlBlockName || comm.cbName === edge.controlBlockName),
      ) ||
      model.smvComms.find((comm) => comm.iedName === edge.publisherIed)
    );
  }
  return undefined;
}

function findConnectedAp(model: SclModel, iedName: string, apName?: string): { ip?: string; mac?: string } | undefined {
  const ied = model.ieds.find((item) => item.name === iedName);
  if (!ied) {
    return undefined;
  }
  const ap =
    (apName ? ied.accessPoints.find((item) => item.name === apName) : undefined) ||
    ied.accessPoints[0];
  if (!ap) {
    return undefined;
  }
  return { ip: ap.ip, mac: ap.mac };
}

function findSubNetwork(model: SclModel, iedName: string, apName?: string): string | undefined {
  for (const subnet of model.subNetworks) {
    const hit = subnet.connectedAps.find((cap) => cap.iedName === iedName && (!apName || cap.apName === apName));
    if (hit) {
      return subnet.name;
    }
  }
  return undefined;
}

function fcdaList(fcdas: EdgeModel['fcdas']): string {
  return fcdas
    .map((fcda) =>
      [fcda.ldInst, fcda.prefix, fcda.lnClass, fcda.lnInst, fcda.doName, fcda.daName, fcda.fc]
        .filter(Boolean)
        .join('/'),
    )
    .join(' | ');
}
