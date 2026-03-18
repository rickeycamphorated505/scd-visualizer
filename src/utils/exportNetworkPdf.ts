import type { SclModel } from '../model/types';

/**
 * Opens a new window with a print-ready summary of a subnetwork and triggers window.print().
 */
export function printNetworkSummary(model: SclModel, subNetworkId?: string): void {
  // Gather data
  const subnet = subNetworkId
    ? model.subNetworks.find((s) => s.name === subNetworkId)
    : model.subNetworks[0];

  const rows: Array<{
    iedName: string;
    apName: string;
    ip: string;
    mac: string;
    gooseOut: number;
    svOut: number;
    unresolved: number;
  }> = [];

  const subnetCaps = subnet ? subnet.connectedAps : model.subNetworks.flatMap((s) => s.connectedAps);
  for (const cap of subnetCaps) {
    const gooseOut = model.gseControls.filter((c) => c.iedName === cap.iedName).length;
    const svOut = model.svControls.filter((c) => c.iedName === cap.iedName).length;
    const unresolved = model.edges.filter(
      (e) => e.subscriberIed === cap.iedName && e.status === 'unresolved'
    ).length;
    const gseComm = model.gseComms.find((g) => g.iedName === cap.iedName && g.apName === cap.apName);
    rows.push({
      iedName: cap.iedName,
      apName: cap.apName,
      ip: cap.ip ?? '—',
      mac: gseComm?.mac ?? '—',
      gooseOut,
      svOut,
      unresolved,
    });
  }
  rows.sort((a, b) => a.iedName.localeCompare(b.iedName));

  // GOOSE/SV traffic estimates
  const gooseTotal = model.gseControls.length;
  const svTotal = model.svControls.length;
  const unresolvedTotal = model.edges.filter((e) => e.status === 'unresolved').length;

  const subnetName = subnet?.name ?? 'All subnets';
  const timestamp = new Date().toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Network Summary — ${subnetName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
  th { background: #f0f0f0; text-align: left; padding: 4px 8px; border: 1px solid #ccc; }
  td { padding: 4px 8px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge-warn { color: #b45309; font-weight: 600; }
  @media print {
    body { margin: 12px; }
    button { display: none; }
    h1 { page-break-before: avoid; }
  }
</style>
</head>
<body>
<h1>Network Summary: ${subnetName}</h1>
<div class="meta">Generated: ${timestamp} &nbsp;|&nbsp; ${rows.length} IED access points &nbsp;|&nbsp; ${gooseTotal} GOOSE controls &nbsp;|&nbsp; ${svTotal} SV controls</div>

<h2 style="font-size:13px;">IED Access Points</h2>
<table>
  <thead>
    <tr>
      <th>IED Name</th>
      <th>AP</th>
      <th>IP</th>
      <th>MAC</th>
      <th>GOOSE Out</th>
      <th>SV Out</th>
      <th>Unresolved</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => `<tr>
      <td>${row.iedName}</td>
      <td>${row.apName}</td>
      <td>${row.ip}</td>
      <td style="font-family:monospace;font-size:10px">${row.mac}</td>
      <td>${row.gooseOut}</td>
      <td>${row.svOut}</td>
      <td ${row.unresolved > 0 ? 'class="badge-warn"' : ''}>${row.unresolved > 0 ? row.unresolved : '—'}</td>
    </tr>`).join('')}
  </tbody>
</table>

<h2 style="font-size:13px;">Traffic Summary</h2>
<table style="max-width:400px">
  <tbody>
    <tr><td>Total GOOSE control blocks</td><td><strong>${gooseTotal}</strong></td></tr>
    <tr><td>Total SV control blocks</td><td><strong>${svTotal}</strong></td></tr>
    <tr><td>Total unresolved subscriptions</td><td><strong ${unresolvedTotal > 0 ? 'class="badge-warn"' : ''}>${unresolvedTotal}</strong></td></tr>
  </tbody>
</table>

<button onclick="window.print()">Print / Save as PDF</button>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    // Popup was blocked — fall back to blob download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-summary-${subnetName}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.write(html);
  win.document.close();
}
