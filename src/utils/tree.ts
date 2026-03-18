import type { SclModel, TreeNodeModel } from '../model/types';

export function buildTree(model: SclModel, query: string): TreeNodeModel[] {
  const q = query.trim().toLowerCase();

  const iedNodes = model.ieds
    .map((ied) => {
      const apNodes: TreeNodeModel[] = ied.accessPoints.map((ap) => ({
        id: `ied:${ied.name}:ap:${ap.name}`,
        label: `AccessPoint ${ap.name}`,
        type: 'access-point',
        children: ap.ldInsts.map((ld) => ({
          id: `ied:${ied.name}:ap:${ap.name}:ld-ref:${ld}`,
          label: `LDevice ref ${ld}`,
          type: 'ldevice',
        })),
      }));

      const ldNodes: TreeNodeModel[] = ied.lDevices.map((ld) => ({
        id: `ied:${ied.name}:ld:${ld.inst}`,
        label: `LDevice ${ld.inst}`,
        type: 'ldevice',
        children: [
          ...(ld.ln0
            ? [
                {
                  id: `ied:${ied.name}:ld:${ld.inst}:ln0`,
                  label: `LN0 ${ld.ln0.lnClass}`,
                  type: 'ln' as const,
                },
              ]
            : []),
          ...ld.lns.map((ln) => ({
            id: `ied:${ied.name}:ld:${ld.inst}:ln:${ln.lnClass}:${ln.inst}`,
            label: `LN ${ln.lnClass}${ln.inst ? `.${ln.inst}` : ''}`,
            type: 'ln' as const,
          })),
        ],
      }));

      const dsNodes = model.dataSets
        .filter((ds) => ds.iedName === ied.name)
        .map((ds) => ({
          id: ds.key,
          label: `DataSet ${ds.name}`,
          type: 'dataset' as const,
        }));

      const controlNodes = [
        ...model.gseControls
          .filter((c) => c.iedName === ied.name)
          .map((c) => ({ id: c.key, label: `GSEControl ${c.name}`, type: 'control' as const })),
        ...model.svControls
          .filter((c) => c.iedName === ied.name)
          .map((c) => ({ id: c.key, label: `SVControl ${c.name}`, type: 'control' as const })),
        ...model.reportControls
          .filter((c) => c.iedName === ied.name)
          .map((c) => ({ id: c.key, label: `ReportControl ${c.name}`, type: 'control' as const })),
      ];

      return {
        id: `ied:${ied.name}`,
        label: `IED ${ied.name}`,
        type: 'ied' as const,
        children: [...apNodes, ...ldNodes, ...dsNodes, ...controlNodes],
      };
    })
    .filter((node) => filterNode(node, q));

  const networkNode: TreeNodeModel = {
    id: 'network-root',
    label: 'Communication',
    type: 'root',
    children: model.subNetworks
      .map((sn) => ({
        id: `subnetwork:${sn.name}`,
        label: `SubNetwork ${sn.name}`,
        type: 'subnetwork' as const,
        children: sn.connectedAps.map((cap) => ({
          id: `connectedap:${sn.name}:${cap.iedName}:${cap.apName}`,
          label: `ConnectedAP ${cap.iedName}/${cap.apName}`,
          type: 'access-point' as const,
        })),
      }))
      .filter((node) => filterNode(node, q)),
  };

  const result: TreeNodeModel[] = [
    {
      id: 'ied-root',
      label: 'IEDs',
      type: 'root',
      children: iedNodes,
    },
    networkNode,
  ];

  return result.filter((node) => filterNode(node, q));
}

function filterNode(node: TreeNodeModel, q: string): boolean {
  if (!q) {
    return true;
  }

  const ownMatch = node.label.toLowerCase().includes(q);
  if (ownMatch) {
    return true;
  }

  if (!node.children || node.children.length === 0) {
    return false;
  }

  node.children = node.children.filter((child) => filterNode(child, q));
  return node.children.length > 0;
}
