import { describe, expect, it } from 'vitest';
import { parseSclDocument } from '../parser/sclParser';
import {
  buildNetworkTopologyView,
  DEFAULT_NETWORK_FILTERS,
} from './buildNetworkView';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <IED name="PUB_IED">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0">
            <DataSet name="dsGoose">
              <FCDA ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal"/>
            </DataSet>
            <DataSet name="dsSv">
              <FCDA ldInst="LD0" lnClass="MMXU" doName="PhV" daName="mag.f"/>
            </DataSet>
            <GSEControl name="GCB1" datSet="dsGoose"/>
            <SampledValueControl name="SVCB1" datSet="dsSv"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="SUB_IED">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0">
            <Inputs>
              <ExtRef iedName="PUB_IED" srcLDInst="LD0" srcCBName="GCB1" serviceType="GOOSE"/>
              <ExtRef iedName="PUB_IED" srcLDInst="LD0" srcCBName="SVCB1" serviceType="SMV"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <Communication>
    <SubNetwork name="PROC">
      <ConnectedAP iedName="PUB_IED" apName="P1">
        <PhysConn><P type="MAC">AA-BB-CC-00-00-01</P></PhysConn>
        <Address><P type="IP">10.1.1.10</P></Address>
        <GSE ldInst="LD0" cbName="GCB1">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-01</P>
            <P type="APPID">1001</P>
            <P type="VLAN-ID">100</P>
            <P type="VLAN-PRIORITY">4</P>
          </Address>
        </GSE>
        <SMV ldInst="LD0" cbName="SVCB1">
          <Address>
            <P type="MAC-Address">01-0C-CD-04-00-01</P>
            <P type="APPID">4001</P>
            <P type="VLAN-ID">400</P>
            <P type="VLAN-PRIORITY">5</P>
          </Address>
        </SMV>
      </ConnectedAP>
      <ConnectedAP iedName="SUB_IED" apName="P1">
        <PhysConn><P type="MAC">AA-BB-CC-00-00-02</P></PhysConn>
        <Address><P type="IP">10.1.1.20</P></Address>
      </ConnectedAP>
    </SubNetwork>
    <SubNetwork name="STATION">
      <ConnectedAP iedName="PUB_IED" apName="P1">
        <Address><P type="IP">172.16.0.10</P></Address>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
</SCL>`;

describe('buildNetworkTopologyView', () => {
  it('maps IED ports to selected SubNetwork only', () => {
    const parsed = parseSclDocument(SAMPLE);
    expect(parsed.model).toBeDefined();
    const view = buildNetworkTopologyView(parsed.model!, 'PROC', DEFAULT_NETWORK_FILTERS);
    expect(view.ports.map((p) => `${p.iedName}/${p.apName}`).sort()).toEqual(['PUB_IED/P1', 'SUB_IED/P1']);
    expect(view.selectedSubNetwork).toBe('PROC');
  });

  it('aggregates flows per port with IN/OUT counters', () => {
    const parsed = parseSclDocument(SAMPLE);
    const view = buildNetworkTopologyView(parsed.model!, 'PROC', DEFAULT_NETWORK_FILTERS);
    const pub = view.ports.find((p) => p.iedName === 'PUB_IED' && p.apName === 'P1');
    const sub = view.ports.find((p) => p.iedName === 'SUB_IED' && p.apName === 'P1');
    expect(pub).toBeDefined();
    expect(sub).toBeDefined();
    expect(pub?.counts.GOOSE.out).toBe(1);
    expect(pub?.counts.SV.out).toBe(1);
    expect(sub?.counts.GOOSE.in).toBe(1);
    expect(sub?.counts.SV.in).toBe(1);
  });

  it('extracts MAC/VLAN/APPID for GOOSE and SV flow items', () => {
    const parsed = parseSclDocument(SAMPLE);
    const view = buildNetworkTopologyView(parsed.model!, 'PROC', DEFAULT_NETWORK_FILTERS);
    const pub = view.ports.find((p) => p.iedName === 'PUB_IED' && p.apName === 'P1');
    const goose = pub?.flowItems.find((f) => f.protocol === 'GOOSE' && f.direction === 'out');
    const sv = pub?.flowItems.find((f) => f.protocol === 'SV' && f.direction === 'out');
    expect(goose?.multicastDstMac).toBe('01-0C-CD-01-00-01');
    expect(goose?.vlanId).toBe('100');
    expect(goose?.vlanPriority).toBe('4');
    expect(goose?.appId).toBe('1001');
    expect(sv?.multicastDstMac).toBe('01-0C-CD-04-00-01');
    expect(sv?.vlanId).toBe('400');
    expect(sv?.vlanPriority).toBe('5');
    expect(sv?.appId).toBe('4001');
  });
});
