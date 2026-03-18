import { describe, expect, it } from 'vitest';
import { parseSclDocument } from './sclParser';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <IED name="PUB_IED">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0" lnType="lt0">
            <DataSet name="dsGoose">
              <FCDA ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal"/>
            </DataSet>
            <GSEControl name="gcb1" datSet="dsGoose" appID="1001"/>
            <SMVControl name="smv1" datSet="dsGoose" confRev="7"/>
            <ReportControl name="rpt1" datSet="dsGoose" rptID="rpt-pub" buffered="true">
              <RptEnabled max="1">
                <ClientLN iedName="SUB_IED" apRef="P1" ldInst="LD1" lnClass="LLN0"/>
              </RptEnabled>
            </ReportControl>
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
              <ExtRef iedName="PUB_IED" ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal" serviceType="GOOSE"/>
              <ExtRef iedName="PUB_IED" srcLDInst="LD0" srcCBName="smv1" serviceType="SMV"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <Communication>
    <SubNetwork name="ProcessBus" type="8-MMS">
      <ConnectedAP iedName="PUB_IED" apName="P1">
        <Address>
          <P type="IP">192.168.1.10</P>
        </Address>
        <GSE ldInst="LD0" cbName="gcb1">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-01</P>
          </Address>
        </GSE>
      </ConnectedAP>
      <ConnectedAP iedName="SUB_IED" apName="P1" />
    </SubNetwork>
  </Communication>
  <Substation name="S1">
    <VoltageLevel name="VL1">
      <Bay name="Bay_A">
        <LNode iedName="PUB_IED" ldInst="LD0" lnClass="LLN0"/>
      </Bay>
      <Bay name="Bay_B">
        <LNode iedName="SUB_IED" ldInst="LD1" lnClass="LLN0"/>
      </Bay>
    </VoltageLevel>
  </Substation>
</SCL>`;

const SAMPLE_WITH_SAMPLED_VALUE_CONTROL = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <IED name="PUB_IED">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0">
            <DataSet name="dsSmv">
              <FCDA ldInst="LD0" lnClass="MMXU" doName="PhV" daName="mag.f"/>
            </DataSet>
            <SampledValueControl name="svcb1" datSet="dsSmv" confRev="3"/>
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
              <ExtRef iedName="PUB_IED" srcLDInst="LD0" srcCBName="svcb1" serviceType="SMV"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
</SCL>`;

const SAMPLE_GOOSE_STRICT_MATCH = `<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <IED name="PUB_IED">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0">
            <DataSet name="dsGoose">
              <FCDA ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal"/>
            </DataSet>
            <GSEControl name="GCB1" datSet="dsGoose"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="GOOSE_SUB">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0">
            <Inputs>
              <ExtRef iedName="PUB_IED" srcLDInst="LD0" srcCBName="GCB1" serviceType="GOOSE"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="SMV_ONLY_SUB">
    <AccessPoint name="P1">
      <Server>
        <LDevice inst="LD2">
          <LN0 lnClass="LLN0">
            <Inputs>
              <ExtRef iedName="PUB_IED" srcLDInst="LD0" srcCBName="SVCB1" serviceType="SMV"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
</SCL>`;

describe('sclParser', () => {
  it('parses IEDs and AccessPoints', () => {
    const result = parseSclDocument(SAMPLE);
    expect(result.error).toBeUndefined();
    expect(result.model?.ieds).toHaveLength(2);
    expect(result.model?.ieds[0].name).toBe('PUB_IED');
    expect(result.model?.ieds[0].accessPoints[0].name).toBe('P1');
  });

  it('parses Communication SubNetworks', () => {
    const result = parseSclDocument(SAMPLE);
    expect(result.model?.subNetworks).toHaveLength(1);
    expect(result.model?.subNetworks[0].name).toBe('ProcessBus');
    expect(result.model?.subNetworks[0].connectedAps).toHaveLength(2);
  });

  it('parses basic GOOSE controls and creates edge', () => {
    const result = parseSclDocument(SAMPLE);
    expect(result.model?.gseControls).toHaveLength(1);
    const edge = result.model?.edges.find((e) => e.signalType === 'GOOSE');
    expect(edge).toBeDefined();
    expect(edge?.publisherIed).toBe('PUB_IED');
    expect(edge?.subscriberIed).toBe('SUB_IED');
  });

  it('parses bay mapping from Substation section', () => {
    const result = parseSclDocument(SAMPLE);
    expect(result.model?.bays).toHaveLength(2);
    const pub = result.model?.ieds.find((i) => i.name === 'PUB_IED');
    expect(pub?.bayNames).toContain('Bay_A');
  });

  it('parses ReportControl and creates report edge', () => {
    const result = parseSclDocument(SAMPLE);
    expect(result.model?.reportControls).toHaveLength(1);
    const edge = result.model?.edges.find((e) => e.signalType === 'REPORT');
    expect(edge).toBeDefined();
    expect(edge?.publisherIed).toBe('PUB_IED');
    expect(edge?.subscriberIed).toBe('SUB_IED');
  });

  it('parses confRev and creates SV edge using srcCBName', () => {
    const result = parseSclDocument(SAMPLE);
    const sv = result.model?.svControls.find((s) => s.name === 'smv1');
    expect(sv?.confRev).toBe('7');
    const edge = result.model?.edges.find((e) => e.signalType === 'SV' && e.controlBlockName === 'smv1');
    expect(edge).toBeDefined();
    expect(edge?.subscriberIed).toBe('SUB_IED');
  });

  it('parses SampledValueControl and resolves SV subscriber', () => {
    const result = parseSclDocument(SAMPLE_WITH_SAMPLED_VALUE_CONTROL);
    const sv = result.model?.svControls.find((s) => s.name === 'svcb1');
    expect(sv).toBeDefined();
    expect(sv?.confRev).toBe('3');
    const edge = result.model?.edges.find((e) => e.signalType === 'SV' && e.controlBlockName === 'svcb1');
    expect(edge).toBeDefined();
    expect(edge?.publisherIed).toBe('PUB_IED');
    expect(edge?.subscriberIed).toBe('SUB_IED');
  });

  it('does not infer GOOSE subscriber from SMV ExtRef', () => {
    const result = parseSclDocument(SAMPLE_GOOSE_STRICT_MATCH);
    const gooseEdges = result.model?.edges.filter((e) => e.signalType === 'GOOSE') || [];
    expect(gooseEdges).toHaveLength(1);
    expect(gooseEdges[0].subscriberIed).toBe('GOOSE_SUB');
  });
});
