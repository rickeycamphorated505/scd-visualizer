import * as XLSX from 'xlsx';
import type {
  DataSetModel,
  DataTypeTemplatesModel,
  FcdaModel,
  GseCommModel,
  SclModel,
} from '../model/types';

/** Which sheets to include in the Excel export. */
export type ExportSheetsOption = 'all' | 'ip_only' | 'signals_only';

function datasetKeyFromControl(
  iedName: string,
  ldInst: string,
  lnClass: string,
  lnInst: string | undefined,
  datasetName: string,
): string {
  return `${iedName}:${ldInst}:${lnClass}:${lnInst ?? ''}:${datasetName}`;
}

function datasetKey(ds: DataSetModel): string {
  return datasetKeyFromControl(ds.iedName, ds.ldInst, ds.lnClass, ds.lnInst, ds.name);
}

/**
 * IEC 61850 object reference: IEDName + "/" + LDInst + "/" + LNName + "." + DOName + [ "." + DAName ]
 * No trailing dot when daName is empty.
 */
function buildReportSignalPath(
  iedName: string,
  ldInst: string,
  lnName: string,
  doName: string,
  daName: string | undefined
): string {
  if (!ldInst && !lnName && !doName && !daName) return iedName;
  const lnPart = ldInst ? `${iedName}/${ldInst}/${lnName}` : (lnName ? `${iedName}/${lnName}` : iedName);
  const doPart = doName ? (daName ? `.${doName}.${daName}` : `.${doName}`) : '';
  return lnPart + doPart;
}

/**
 * GOOSE/SMV signal reference: IEDName + LogicalDevice + "/" + LogicalNode + "." + DataObject + "." + DataAttribute
 * Example: IED1LD0/XCBR1.Pos.stVal (no trailing dot when daName empty).
 */
function buildGooseSmvSignalReference(
  iedName: string,
  ldInst: string,
  lnName: string,
  doName: string,
  daName: string | undefined
): string {
  if (!lnName && !doName && !daName) return iedName + (ldInst || '');
  const prefix = iedName + (ldInst || '');
  const doPart = doName ? (daName ? `.${doName}.${daName}` : `.${doName}`) : '';
  return `${prefix}/${lnName}${doPart}`;
}

function getLnType(
  model: SclModel,
  iedName: string,
  ldInst: string,
  lnClass: string,
  lnInst: string | undefined
): string | undefined {
  const ied = model.ieds.find((i) => i.name === iedName);
  if (!ied) return undefined;
  const ld = ied.lDevices.find((l) => l.inst === ldInst);
  if (!ld) return undefined;
  const inst = lnInst ?? '';
  if (lnClass === 'LLN0') {
    return ld.ln0?.lnType;
  }
  const ln = ld.lns.find((n) => n.lnClass === lnClass && n.inst === inst);
  return ln?.lnType;
}

/** Resolve DO → list of DA names via DataTypeTemplates (LNodeType → DO → DOType → DA). Filter by fc if set. */
function expandDoToDas(
  dtt: DataTypeTemplatesModel | undefined,
  lnType: string | undefined,
  doName: string,
  fc: string | undefined
): string[] {
  if (!dtt || !lnType) return [];
  const lnt = dtt.lNodeTypes.get(lnType);
  if (!lnt) return [];
  const doRef = lnt.dos.find((d) => d.name === doName);
  if (!doRef) return [];
  const doType = dtt.doTypes.get(doRef.type);
  if (!doType) return [];
  const excludeDaNames = new Set(['t', 'q']);
  return doType.das
    .filter((da) => !fc || (da.fc && da.fc.toUpperCase() === fc.toUpperCase()))
    .filter((da) => !excludeDaNames.has(da.name.toLowerCase()))
    .map((da) => da.name);
}

/** One expanded signal (one row for GOOSE/SMV signals sheet). */
interface ExpandedSignal {
  ldInst: string;
  lnName: string;
  doName: string;
  daName: string;
  fc: string;
}

/**
 * Expand FCDAs to final signals: one per DA, expanding whole-DO via DataTypeTemplates.
 * Uses same rules as report (exclude t, q). Deduplicates by (ldInst, lnName, doName, daName).
 */
function expandFcdasToSignals(
  model: SclModel,
  iedName: string,
  fcdas: FcdaModel[],
  defaultLdInst: string,
  defaultLnClass: string,
  defaultLnInst: string | undefined
): ExpandedSignal[] {
  const dtt = model.dataTypeTemplates;
  const seen = new Set<string>();
  const out: ExpandedSignal[] = [];

  for (const fcda of fcdas) {
    const ldInst = fcda.ldInst ?? defaultLdInst;
    const lnName = (fcda.prefix ?? '') + (fcda.lnClass ?? '') + (fcda.lnInst ?? '');
    const doName = fcda.doName ?? '';
    const fc = fcda.fc ?? '';

    if (fcda.daName) {
      const key = `${ldInst}:${lnName}:${doName}:${fcda.daName}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ ldInst, lnName, doName, daName: fcda.daName, fc });
      }
    } else if (doName) {
      const lnType = getLnType(model, iedName, ldInst, fcda.lnClass ?? defaultLnClass, fcda.lnInst ?? defaultLnInst);
      const das = expandDoToDas(dtt, lnType, doName, fc || undefined);
      for (const daName of das) {
        const key = `${ldInst}:${lnName}:${doName}:${daName}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ ldInst, lnName, doName, daName, fc });
        }
      }
    }
  }
  return out;
}

export interface ExportIssueRow {
  source: 'Report' | 'GOOSE' | 'SMV';
  sourceName: string;
  iedName: string;
  ldInst: string;
  lnName: string;
  doName: string;
  fc: string;
  reason: string;
}

/** Collect FCDA entries that reference a whole DO but could not be expanded (missing DataTypeTemplates or DO type). */
function getExportIssues(model: SclModel): ExportIssueRow[] {
  const dtt = model.dataTypeTemplates;
  const issues: ExportIssueRow[] = [];
  const dataSetMap = new Map(model.dataSets.map((ds) => [datasetKey(ds), ds]));

  function checkControl(
    source: 'Report' | 'GOOSE' | 'SMV',
    iedName: string,
    ldInst: string,
    lnClass: string,
    lnInst: string | undefined,
    datSet: string | undefined,
    sourceName: string
  ): void {
    if (!datSet) return;
    const ds = dataSetMap.get(datasetKeyFromControl(iedName, ldInst, lnClass, lnInst, datSet));
    const fcdas = ds?.fcdas ?? [];
    for (const fcda of fcdas) {
      if (fcda.daName) continue;
      const doName = fcda.doName ?? '';
      if (!doName) continue;
      const ld = fcda.ldInst ?? ldInst;
      const lnName = (fcda.prefix ?? '') + (fcda.lnClass ?? '') + (fcda.lnInst ?? '');
      const lnType = getLnType(model, iedName, ld, fcda.lnClass ?? lnClass, fcda.lnInst ?? lnInst);
      const das = expandDoToDas(dtt, lnType, doName, fcda.fc || undefined);
      if (das.length === 0) {
        issues.push({
          source,
          sourceName,
          iedName,
          ldInst: ld,
          lnName,
          doName,
          fc: fcda.fc ?? '',
          reason: !dtt ? 'DataTypeTemplates missing' : !lnType ? 'LN type not found' : 'DO type or DA list not found',
        });
      }
    }
  }

  for (const rpt of model.reportControls) {
    checkControl('Report', rpt.iedName ?? '', rpt.ldInst ?? '', rpt.lnClass ?? '', rpt.lnInst, rpt.datSet, rpt.name ?? '');
  }
  for (const ctrl of model.gseControls) {
    checkControl('GOOSE', ctrl.iedName ?? '', ctrl.ldInst ?? '', ctrl.lnClass ?? '', ctrl.lnInst, ctrl.datSet, ctrl.name ?? '');
  }
  for (const ctrl of model.svControls) {
    checkControl('SMV', ctrl.iedName ?? '', ctrl.ldInst ?? '', ctrl.lnClass ?? '', ctrl.lnInst, ctrl.datSet, ctrl.name ?? '');
  }
  return issues;
}

function buildAddressRows(model: SclModel): string[][] {
  const rows: string[][] = [];
  for (const subnet of model.subNetworks) {
    for (const cap of subnet.connectedAps) {
      const iedName = cap.iedName;
      const apName = cap.apName;
      const gooseAppIds = model.gseComms
        .filter((g) => g.iedName === iedName && g.apName === apName)
        .map((g) => g.appId ?? '')
        .filter(Boolean)
        .join(', ');
      const svAppIds = model.smvComms
        .filter((s) => s.iedName === iedName && s.apName === apName)
        .map((s) => s.appId ?? '')
        .filter(Boolean)
        .join(', ');
      const vlanSet = new Set<string>();
      model.gseComms.filter((g) => g.iedName === iedName && g.apName === apName && g.vlanId).forEach((g) => vlanSet.add(g.vlanId!));
      model.smvComms.filter((s) => s.iedName === iedName && s.apName === apName && s.vlanId).forEach((s) => vlanSet.add(s.vlanId!));
      const gseComm = model.gseComms.find((g) => g.iedName === iedName && g.apName === apName);
      rows.push([
        iedName, apName,
        cap.ip ?? '', cap.netmask ?? '', cap.gateway ?? '',
        gseComm?.mac ?? '',
        gooseAppIds, svAppIds,
        Array.from(vlanSet).join(', ')
      ]);
    }
  }
  return rows;
}

/**
 * Sheet 1: IP / net – IED name (A), Access Point (B), SubNetwork (C), IP (D), Gateway (E), Netmask (F)
 * Sheet 2: Report merki – IED (A), Report name (B), Dataset name (C), LogicalDevice (D), LogicalNode (E), DataObject (F), DataAttribute (G), FC (H), Full path (I)
 */
export function buildIpSheetWorkbook(model: SclModel, sheetsOption: ExportSheetsOption = 'all'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const includeIp = sheetsOption !== 'signals_only';
  const includeSignals = sheetsOption !== 'ip_only';

  // Add Addresses sheet first (only for 'all' option)
  if (sheetsOption === 'all') {
    const addressHeader = ['IED Name', 'AP', 'IP', 'Netmask', 'Gateway', 'MAC', 'GOOSE APPIDs', 'SV APPIDs', 'VLAN IDs'];
    const addressRows = buildAddressRows(model);
    const addressSheet = XLSX.utils.aoa_to_sheet([addressHeader, ...addressRows]);
    XLSX.utils.book_append_sheet(wb, addressSheet, 'Addresses');
  }

  if (includeIp) {
    const headers1 = ['IED name', 'Access Point', 'SubNetwork', 'IP address', 'Gateway', 'Netmask'];
    const rows1: string[][] = [headers1];
    for (const sub of model.subNetworks) {
      for (const cap of sub.connectedAps) {
        rows1.push([
          cap.iedName ?? '',
          cap.apName ?? '',
          sub.name ?? '',
          cap.ip ?? '',
          cap.gateway ?? '',
          cap.netmask ?? '',
        ]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows1), 'IP Address');
  }

  const dataSetMap = new Map(model.dataSets.map((ds) => [datasetKey(ds), ds]));
  const dtt = model.dataTypeTemplates;
  const iedName = (r: { iedName?: string }) => r.iedName ?? '';

  if (includeSignals) {
  const headers2 = [
    'IED name',
    'Report name',
    'Dataset name',
    'LogicalDevice',
    'LogicalNode',
    'DataObject',
    'DataAttribute',
    'FC',
    'Path',
  ];
  const rows2: string[][] = [headers2];
  for (const rpt of model.reportControls) {
    const ds = rpt.datSet
      ? dataSetMap.get(datasetKeyFromControl(rpt.iedName, rpt.ldInst, rpt.lnClass, rpt.lnInst, rpt.datSet))
      : undefined;
    const fcdas = ds?.fcdas ?? [];
    for (const fcda of fcdas) {
      const ldInst = fcda.ldInst ?? rpt.ldInst ?? '';
      const lnName = (fcda.prefix ?? '') + (fcda.lnClass ?? '') + (fcda.lnInst ?? '');
      const doName = fcda.doName ?? '';
      const fc = fcda.fc;

      if (fcda.daName) {
        rows2.push([
          iedName(rpt),
          rpt.name ?? '',
          rpt.datSet ?? '',
          ldInst,
          lnName,
          doName,
          fcda.daName,
          fc ?? '',
          buildReportSignalPath(iedName(rpt), ldInst, lnName, doName, fcda.daName),
        ]);
      } else if (doName) {
        const lnType = getLnType(model, iedName(rpt), ldInst, fcda.lnClass ?? rpt.lnClass ?? '', fcda.lnInst ?? rpt.lnInst);
        const das = expandDoToDas(dtt, lnType, doName, fc);
        if (das.length > 0) {
          for (const daName of das) {
            rows2.push([
              iedName(rpt),
              rpt.name ?? '',
              rpt.datSet ?? '',
              ldInst,
              lnName,
              doName,
              daName,
              fc ?? '',
              buildReportSignalPath(iedName(rpt), ldInst, lnName, doName, daName),
            ]);
          }
        } else {
          rows2.push([
            iedName(rpt),
            rpt.name ?? '',
            rpt.datSet ?? '',
            ldInst,
            lnName,
            doName,
            '',
            fc ?? '',
            buildReportSignalPath(iedName(rpt), ldInst, lnName, doName, undefined),
          ]);
        }
      }
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  XLSX.utils.book_append_sheet(wb, ws2, 'Report signals');

  // —— Sheet: Report Overview (one row per ReportControl)
  const reportOverviewHeaders = [
    'IED Name',
    'Logical Device',
    'Report Name',
    'Dataset',
    'Signal Count',
    'RptID',
    'ConfRev',
    'Buffered',
  ];
  const reportOverviewRows: string[][] = [reportOverviewHeaders];
  for (const rpt of model.reportControls) {
    const ds = rpt.datSet
      ? dataSetMap.get(datasetKeyFromControl(rpt.iedName, rpt.ldInst, rpt.lnClass, rpt.lnInst, rpt.datSet))
      : undefined;
    const fcdas = ds?.fcdas ?? [];
    let signalCount = 0;
    for (const fcda of fcdas) {
      if (fcda.daName) signalCount += 1;
      else if (fcda.doName) {
        const lnType = getLnType(model, iedName(rpt), fcda.ldInst ?? rpt.ldInst ?? '', fcda.lnClass ?? rpt.lnClass ?? '', fcda.lnInst ?? rpt.lnInst);
        const das = expandDoToDas(dtt, lnType, fcda.doName, fcda.fc || undefined);
        signalCount += das.length || 1;
      }
    }
    reportOverviewRows.push([
      iedName(rpt),
      rpt.ldInst ?? '',
      rpt.name ?? '',
      rpt.datSet ?? '',
      String(signalCount),
      rpt.rptId ?? '',
      rpt.confRev ?? '',
      rpt.buffered ? 'true' : 'false',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reportOverviewRows), 'Report Overview');

  // —— Sheet: GOOSE Signals (one row per GOOSE signal after FCDA expansion)
  const gooseSignalHeaders = [
    'IED Name',
    'Logical Device',
    'GOOSE Name',
    'Dataset',
    'Logical Node',
    'Data Object',
    'Data Attribute',
    'FC',
    'Signal Reference',
    'APPID',
    'MAC',
    'VLAN',
    'Priority',
    'MinTime',
    'MaxTime',
  ];
  const gooseSignalRows: string[][] = [gooseSignalHeaders];
  for (const ctrl of model.gseControls) {
    const ds = ctrl.datSet
      ? dataSetMap.get(datasetKeyFromControl(ctrl.iedName, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst, ctrl.datSet))
      : undefined;
    const fcdas = ds?.fcdas ?? [];
    const signals = expandFcdasToSignals(model, ctrl.iedName, fcdas, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst);
    const comm: GseCommModel | undefined = model.gseComms.find(
      (c) => c.iedName === ctrl.iedName && c.cbName === ctrl.name
    );
    for (const sig of signals) {
      gooseSignalRows.push([
        ctrl.iedName ?? '',
        sig.ldInst,
        ctrl.name ?? '',
        ctrl.datSet ?? '',
        sig.lnName,
        sig.doName,
        sig.daName,
        sig.fc,
        buildGooseSmvSignalReference(ctrl.iedName ?? '', sig.ldInst, sig.lnName, sig.doName, sig.daName),
        comm?.appId ?? '',
        comm?.mac ?? '',
        comm?.vlanId ?? '',
        comm?.vlanPriority ?? '',
        comm?.minTime ?? '',
        comm?.maxTime ?? '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gooseSignalRows), 'GOOSE Signals');

  // —— Sheet: GOOSE Overview (one row per GSEControl)
  const gooseOverviewHeaders = [
    'IED Name',
    'Logical Device',
    'GOOSE Name',
    'Dataset',
    'Signal Count',
    'APPID',
    'MAC',
    'VLAN',
    'Priority',
    'MinTime',
    'MaxTime',
    'ConfRev',
  ];
  const gooseOverviewRows: string[][] = [gooseOverviewHeaders];
  for (const ctrl of model.gseControls) {
    const ds = ctrl.datSet
      ? dataSetMap.get(datasetKeyFromControl(ctrl.iedName, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst, ctrl.datSet))
      : undefined;
    const fcdas = ds?.fcdas ?? [];
    const signals = expandFcdasToSignals(model, ctrl.iedName, fcdas, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst);
    const comm = model.gseComms.find((c) => c.iedName === ctrl.iedName && c.cbName === ctrl.name);
    gooseOverviewRows.push([
      ctrl.iedName ?? '',
      ctrl.ldInst ?? '',
      ctrl.name ?? '',
      ctrl.datSet ?? '',
      String(signals.length),
      comm?.appId ?? '',
      comm?.mac ?? '',
      comm?.vlanId ?? '',
      comm?.vlanPriority ?? '',
      comm?.minTime ?? '',
      comm?.maxTime ?? '',
      ctrl.confRev ?? '',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gooseOverviewRows), 'GOOSE Overview');

  // —— Sheet: SMV Signals (one row per SMV signal after FCDA expansion)
  const smvSignalHeaders = [
    'IED Name',
    'Logical Device',
    'SMV Name',
    'Dataset',
    'Logical Node',
    'Data Object',
    'Data Attribute',
    'FC',
    'Signal Reference',
    'APPID',
    'MAC',
    'VLAN',
    'Priority',
    'SampleRate',
    'NoASDU',
    'SmpMod',
  ];
  const smvSignalRows: string[][] = [smvSignalHeaders];
  for (const ctrl of model.svControls) {
    const ds = ctrl.datSet
      ? dataSetMap.get(datasetKeyFromControl(ctrl.iedName, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst, ctrl.datSet))
      : undefined;
    const fcdas = ds?.fcdas ?? [];
    const signals = expandFcdasToSignals(model, ctrl.iedName, fcdas, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst);
    const comm = model.smvComms.find((c) => c.iedName === ctrl.iedName && c.cbName === ctrl.name);
    for (const sig of signals) {
      smvSignalRows.push([
        ctrl.iedName ?? '',
        sig.ldInst,
        ctrl.name ?? '',
        ctrl.datSet ?? '',
        sig.lnName,
        sig.doName,
        sig.daName,
        sig.fc,
        buildGooseSmvSignalReference(ctrl.iedName ?? '', sig.ldInst, sig.lnName, sig.doName, sig.daName),
        comm?.appId ?? '',
        comm?.mac ?? '',
        comm?.vlanId ?? '',
        comm?.vlanPriority ?? '',
        comm?.smpRate ?? ctrl.smpRate ?? '',
        comm?.nofASDU ?? ctrl.nofASDU ?? '',
        comm?.smpMod ?? ctrl.smpMod ?? '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(smvSignalRows), 'SMV Signals');

  // —— Sheet: SMV Overview (one row per SampledValueControl / SVControl)
  const smvOverviewHeaders = [
    'IED Name',
    'Logical Device',
    'SMV Name',
    'Dataset',
    'Signal Count',
    'APPID',
    'MAC',
    'VLAN',
    'Priority',
    'SampleRate',
    'NoASDU',
    'SmpMod',
    'ConfRev',
  ];
  const smvOverviewRows: string[][] = [smvOverviewHeaders];
  for (const ctrl of model.svControls) {
    const ds = ctrl.datSet
      ? dataSetMap.get(datasetKeyFromControl(ctrl.iedName, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst, ctrl.datSet))
      : undefined;
    const fcdas = ds?.fcdas ?? [];
    const signals = expandFcdasToSignals(model, ctrl.iedName, fcdas, ctrl.ldInst, ctrl.lnClass, ctrl.lnInst);
    const comm = model.smvComms.find((c) => c.iedName === ctrl.iedName && c.cbName === ctrl.name);
    smvOverviewRows.push([
      ctrl.iedName ?? '',
      ctrl.ldInst ?? '',
      ctrl.name ?? '',
      ctrl.datSet ?? '',
      String(signals.length),
      comm?.appId ?? '',
      comm?.mac ?? '',
      comm?.vlanId ?? '',
      comm?.vlanPriority ?? '',
      comm?.smpRate ?? ctrl.smpRate ?? '',
      comm?.nofASDU ?? ctrl.nofASDU ?? '',
      comm?.smpMod ?? ctrl.smpMod ?? '',
      ctrl.confRev ?? '',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(smvOverviewRows), 'SMV Overview');
  }

  if (includeSignals) {
    const issues = getExportIssues(model);
    if (issues.length > 0) {
      const issueHeaders = ['Source', 'Source Name', 'IED Name', 'Logical Device', 'Logical Node', 'Data Object', 'FC', 'Reason'];
      const issueRows = issues.map((i) => [i.source, i.sourceName, i.iedName, i.ldInst, i.lnName, i.doName, i.fc, i.reason]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([issueHeaders, ...issueRows]), 'Export issues');
      console.warn(
        `[Export] ${issues.length} FCDA(s) could not be expanded to Data Attributes — see "Export issues" sheet. ` +
        `Common cause: missing or incomplete DataTypeTemplates.`
      );
    }
  }

  return wb;
}

export function downloadExcelIp(model: SclModel, baseName: string, sheetsOption: ExportSheetsOption = 'all'): void {
  const wb = buildIpSheetWorkbook(model, sheetsOption);
  const fileName = `${baseName.replace(/\.(scd|xml|cid|icd)$/i, '')}-export.xlsx`;
  XLSX.writeFile(wb, fileName);
}
