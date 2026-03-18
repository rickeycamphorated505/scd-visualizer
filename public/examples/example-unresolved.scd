<?xml version="1.0" encoding="UTF-8"?>
<SCL>
  <Header id="demo-unresolved"/>
  <IED name="PUB_X">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LDX">
          <LN0 lnClass="LLN0">
            <DataSet name="DS_X">
              <FCDA ldInst="LDX" lnClass="PTRC" doName="Op" daName="general" fc="ST"/>
            </DataSet>
            <GSEControl name="GCB_X" datSet="DS_X"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>

  <IED name="SUB_Y">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LDY">
          <LN0 lnClass="LLN0">
            <Inputs>
              <ExtRef serviceType="GOOSE"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>

  <Communication>
    <SubNetwork name="ProcessBus" type="8-MMS">
      <ConnectedAP iedName="PUB_X" apName="AP1">
        <GSE ldInst="LDX" cbName="GCB_X"/>
      </ConnectedAP>
      <ConnectedAP iedName="SUB_Y" apName="AP1" />
    </SubNetwork>
  </Communication>

  <Substation name="SS2">
    <VoltageLevel name="33kV">
      <Bay name="Bay_X">
        <LNode iedName="PUB_X" ldInst="LDX" lnClass="LLN0"/>
      </Bay>
      <Bay name="Bay_Y">
        <LNode iedName="SUB_Y" ldInst="LDY" lnClass="LLN0"/>
      </Bay>
    </VoltageLevel>
  </Substation>
</SCL>
