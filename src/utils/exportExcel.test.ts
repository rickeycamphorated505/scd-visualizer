import { describe, expect, it } from 'vitest';
import { parseSclDocument } from '../parser/sclParser';
import { buildIpSheetWorkbook } from './exportExcel';

const MINIMAL_SCL = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <Header id="test"/>
  <IED name="IED1">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0" lnType="lt0">
            <DataSet name="DS1">
              <FCDA ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal" fc="ST"/>
            </DataSet>
            <GSEControl name="GCB1" datSet="DS1"/>
            <ReportControl name="RPT1" datSet="DS1" rptID="r1" buffered="false">
              <RptEnabled max="1"/>
            </ReportControl>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <Communication>
    <SubNetwork name="SN1">
      <ConnectedAP iedName="IED1" apName="AP1">
        <Address><P type="IP">10.0.0.1</P></Address>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
</SCL>`;

function getSheetNames(wb: ReturnType<typeof buildIpSheetWorkbook>): string[] {
  return wb.SheetNames;
}

describe('exportExcel', () => {
  it('buildIpSheetWorkbook with "all" includes IP Address, Report, GOOSE, SMV sheets', () => {
    const result = parseSclDocument(MINIMAL_SCL);
    expect(result.error).toBeUndefined();
    expect(result.model).toBeDefined();
    const wb = buildIpSheetWorkbook(result.model!, 'all');
    const names = getSheetNames(wb);
    expect(names).toContain('IP Address');
    expect(names).toContain('Report signals');
    expect(names).toContain('Report Overview');
    expect(names).toContain('GOOSE Signals');
    expect(names).toContain('GOOSE Overview');
    expect(names).toContain('SMV Signals');
    expect(names).toContain('SMV Overview');
  });

  it('buildIpSheetWorkbook with "ip_only" has only IP Address sheet', () => {
    const result = parseSclDocument(MINIMAL_SCL);
    expect(result.model).toBeDefined();
    const wb = buildIpSheetWorkbook(result.model!, 'ip_only');
    const names = getSheetNames(wb);
    expect(names).toEqual(['IP Address']);
  });

  it('buildIpSheetWorkbook with "signals_only" has no IP Address but has signal sheets', () => {
    const result = parseSclDocument(MINIMAL_SCL);
    expect(result.model).toBeDefined();
    const wb = buildIpSheetWorkbook(result.model!, 'signals_only');
    const names = getSheetNames(wb);
    expect(names).not.toContain('IP Address');
    expect(names).toContain('Report signals');
    expect(names).toContain('Report Overview');
    expect(names).toContain('GOOSE Signals');
    expect(names).toContain('GOOSE Overview');
    expect(names).toContain('SMV Signals');
    expect(names).toContain('SMV Overview');
  });

  it('Report signals sheet has expected headers', () => {
    const result = parseSclDocument(MINIMAL_SCL);
    const wb = buildIpSheetWorkbook(result.model!, 'all');
    const sheet = wb.Sheets['Report signals'];
    expect(sheet).toBeDefined();
    const range = (sheet as { ['!ref']?: string })['!ref'];
    expect(range).toBeDefined();
    const data = (sheet as { [key: string]: { v?: string } })[ 'A1'];
    expect(data?.v).toBe('IED name');
  });

  it('GOOSE Signals sheet contains signal reference with IED and LD', () => {
    const result = parseSclDocument(MINIMAL_SCL);
    const wb = buildIpSheetWorkbook(result.model!, 'all');
    const sheet = wb.Sheets['GOOSE Signals'];
    expect(sheet).toBeDefined();
    const i2 = (sheet as { [key: string]: { v?: string } })['I2'];
    expect(i2?.v).toMatch(/IED1/);
    expect(i2?.v).toMatch(/LD0/);
  });
});
