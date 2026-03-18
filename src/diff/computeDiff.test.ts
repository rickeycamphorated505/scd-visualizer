import { describe, expect, it } from 'vitest';
import { parseSclDocument } from '../parser/sclParser';
import { computeDiff } from './computeDiff';

const A = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <IED name="IED_A">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0">
            <DataSet name="DS1">
              <FCDA ldInst="LD0" lnClass="PTOC" doName="Str" daName="stVal"/>
            </DataSet>
            <GSEControl name="GCB1" datSet="DS1" confRev="1"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <Communication>
    <SubNetwork name="SB">
      <ConnectedAP iedName="IED_A" apName="P1">
        <Address><P type="IP">10.0.0.1</P></Address>
        <GSE ldInst="LD0" cbName="GCB1">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-01</P>
            <P type="APPID">1001</P>
            <P type="VLAN-ID">100</P>
          </Address>
        </GSE>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
</SCL>`;

const B = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <IED name="IED_A">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0">
            <DataSet name="DS1">
              <FCDA ldInst="LD0" lnClass="PTOC" doName="Str" daName="stVal"/>
              <FCDA ldInst="LD0" lnClass="PTOC" doName="Op" daName="general"/>
            </DataSet>
            <GSEControl name="GCB1" datSet="DS1" confRev="2"/>
            <ReportControl name="R1" datSet="DS1"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="IED_B">
    <AccessPoint name="P1"><Server><LDevice inst="LD1"><LN0 lnClass="LLN0"/></LDevice></Server></AccessPoint>
  </IED>
  <Communication>
    <SubNetwork name="SB">
      <ConnectedAP iedName="IED_A" apName="P1">
        <Address><P type="IP">10.0.0.9</P></Address>
        <GSE ldInst="LD0" cbName="GCB1">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-09</P>
            <P type="APPID">1002</P>
            <P type="VLAN-ID">200</P>
          </Address>
        </GSE>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
</SCL>`;

describe('computeDiff', () => {
  it('finds IED, ControlBlock, DataSet and Communication changes', () => {
    const parsedA = parseSclDocument(A);
    const parsedB = parseSclDocument(B);
    expect(parsedA.model).toBeDefined();
    expect(parsedB.model).toBeDefined();

    const diff = computeDiff(parsedA.model!, parsedB.model!);
    expect(diff.changes.some((c) => c.entityType === 'IED' && c.changeType === 'added')).toBe(true);
    expect(diff.changes.some((c) => c.entityType === 'ControlBlock' && c.changeType === 'modified')).toBe(true);
    expect(diff.changes.some((c) => c.entityType === 'DataSet' && c.changeType === 'modified')).toBe(true);
    expect(
      diff.changes.some(
        (c) =>
          c.entityType === 'ConnectedAP' &&
          c.changeType === 'modified' &&
          c.details.some((d) => ['ip', 'gseAppId', 'gseVlanId', 'gseMac'].includes(d.field)),
      ),
    ).toBe(true);
  });
});
