<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <Header id="demo-basic"/>
  <IED name="PUB_A">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0" lnType="lt0">
            <DataSet name="DS_GOOSE_1">
              <FCDA ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal" fc="ST"/>
            </DataSet>
            <DataSet name="DS_SV_1">
              <FCDA ldInst="LD0" lnClass="MMXU" lnInst="1" doName="A" daName="phsA" fc="MX"/>
            </DataSet>
            <GSEControl name="GCB_TRIP" datSet="DS_GOOSE_1" appID="0001"/>
            <SMVControl name="SMV_MU1" datSet="DS_SV_1" smvID="MU_STREAM_1"/>
            <ReportControl name="RPT_STATUS" datSet="DS_GOOSE_1" rptID="RPT_A" buffered="true">
              <RptEnabled max="1">
                <ClientLN iedName="SUB_B" apRef="AP1" ldInst="LD1" lnClass="LLN0"/>
              </RptEnabled>
            </ReportControl>
          </LN0>
          <LN prefix="" lnClass="PTOC" inst="1" lnType="ptoc1"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>

  <IED name="SUB_B">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0">
            <Inputs>
              <ExtRef iedName="PUB_A" ldInst="LD0" lnClass="PTOC" lnInst="1" doName="Str" daName="stVal" serviceType="GOOSE"/>
              <ExtRef iedName="PUB_A" serviceType="SMV"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>

  <Communication>
    <SubNetwork name="StationBus" type="8-MMS">
      <ConnectedAP iedName="PUB_A" apName="AP1">
        <PhysConn>
          <P type="IP">10.1.0.10</P>
          <P type="MAC">00-1A-2B-3C-4D-5E</P>
        </PhysConn>
        <GSE ldInst="LD0" cbName="GCB_TRIP">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-10</P>
            <P type="APPID">0001</P>
          </Address>
        </GSE>
        <SMV ldInst="LD0" cbName="SMV_MU1">
          <Address>
            <P type="MAC-Address">01-0C-CD-04-00-10</P>
            <P type="APPID">4001</P>
          </Address>
        </SMV>
      </ConnectedAP>
      <ConnectedAP iedName="SUB_B" apName="AP1">
        <PhysConn>
          <P type="IP">10.1.0.20</P>
        </PhysConn>
      </ConnectedAP>
    </SubNetwork>
  </Communication>

  <Substation name="SS1">
    <VoltageLevel name="132kV">
      <Bay name="Bay_Trip">
        <LNode iedName="PUB_A" ldInst="LD0" lnClass="LLN0"/>
      </Bay>
      <Bay name="Bay_Sub">
        <LNode iedName="SUB_B" ldInst="LD1" lnClass="LLN0"/>
      </Bay>
    </VoltageLevel>
  </Substation>
</SCL>
