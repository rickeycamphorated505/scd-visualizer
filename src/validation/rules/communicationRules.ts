import type { SclModel } from '../../model/types';
import type { ValidationIssue } from '../types';
import { buildIssueId } from '../utils';

// Note: DUPLICATE_CONNECTEDAP_IP is covered by LNET_002.
// Note: DUPLICATE_GSE_SMV_MAC / DUPLICATE_GSE_SMV_APPID are covered by LNET_009 / LNET_015.
// This module only emits checks not covered by any LNET rule.

export function runCommunicationRules(model: SclModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const subnet of model.subNetworks) {
    const subnetIps: Array<{ iedName: string; apName: string; ip: string; path: string }> = [];

    for (const cap of subnet.connectedAps) {
      const path = `/SCL/Communication/SubNetwork[@name='${subnet.name}']/ConnectedAP[@iedName='${cap.iedName}' and @apName='${cap.apName}']`;
      const capMac = cap.physConns.find((p) => (p.pType || '').toUpperCase().includes('MAC'))?.value;
      const gseComms = model.gseComms.filter((c) => c.iedName === cap.iedName && c.apName === cap.apName);
      const smvComms = model.smvComms.filter((c) => c.iedName === cap.iedName && c.apName === cap.apName);
      const gseMac = gseComms.find((c) => (c.mac || '').trim())?.mac;
      const smvMac = smvComms.find((c) => (c.mac || '').trim())?.mac;
      const mac = capMac || gseMac || smvMac;
      const hasSampled = smvComms.length > 0;
      const hasGoose = gseComms.length > 0;
      const expectsMac = hasSampled || hasGoose;
      const expectsIp = !expectsMac;

      if (!cap.ip && !mac) {
        issues.push({
          id: buildIssueId('CONNECTEDAP_MISSING_ADDRESS', path),
          severity: 'warn',
          category: 'interop',
          code: 'CONNECTEDAP_MISSING_ADDRESS',
          message: `ConnectedAP '${cap.iedName}/${cap.apName}' has no IP/MAC address.`,
          path,
          protocol: 'Generic',
          context: { iedName: cap.iedName, apName: cap.apName },
          entityRef: { type: 'ConnectedAP', id: `cap:${subnet.name}:${cap.iedName}:${cap.apName}`, iedName: cap.iedName },
          resolved: false,
          fixHint: 'Populate Address/PhysConn P(type=IP or MAC).',
        });
      }
      if (expectsIp && !cap.ip) {
        issues.push({
          id: buildIssueId('CONNECTEDAP_MISSING_IP', `${path}:ip`),
          severity: 'warn',
          category: 'interop',
          code: 'CONNECTEDAP_MISSING_IP',
          message: `ConnectedAP '${cap.iedName}/${cap.apName}' is missing IP.`,
          path,
          protocol: 'Generic',
          context: { iedName: cap.iedName, apName: cap.apName },
          entityRef: { type: 'ConnectedAP', id: `cap:${subnet.name}:${cap.iedName}:${cap.apName}`, iedName: cap.iedName },
          resolved: false,
          fixHint: 'Add Address/P(type=IP) for this ConnectedAP.',
        });
      }
      if (expectsMac && !mac) {
        issues.push({
          id: buildIssueId('CONNECTEDAP_MISSING_MAC', `${path}:mac`),
          severity: 'warn',
          category: 'interop',
          code: 'CONNECTEDAP_MISSING_MAC',
          message: `ConnectedAP '${cap.iedName}/${cap.apName}' is missing MAC for GOOSE/SV traffic.`,
          path,
          protocol: hasGoose ? 'GOOSE' : 'SV',
          context: { iedName: cap.iedName, apName: cap.apName },
          entityRef: { type: 'ConnectedAP', id: `cap:${subnet.name}:${cap.iedName}:${cap.apName}`, iedName: cap.iedName },
          resolved: false,
          fixHint: 'Add Address/P(type=MAC-Address) under GSE/SMV.',
        });
      }

      if (cap.ip) {
        const key = normalizeIp(cap.ip);
        if (key) {
          subnetIps.push({
            iedName: cap.iedName,
            apName: cap.apName,
            ip: key,
            path,
          });
        }
      }
    }

    const subnetGroups = new Map<string, Array<{ iedName: string; apName: string; ip: string; path: string }>>();
    for (const entry of subnetIps) {
      const net = ipv4Network24(entry.ip);
      if (!net) {
        continue;
      }
      if (!subnetGroups.has(net)) {
        subnetGroups.set(net, []);
      }
      subnetGroups.get(net)!.push(entry);
    }
    if (subnetGroups.size > 1) {
      const dominant = Array.from(subnetGroups.entries()).sort((a, b) => b[1].length - a[1].length)[0][0];
      for (const [network, entries] of subnetGroups.entries()) {
        if (network === dominant) {
          continue;
        }
        for (const entry of entries) {
          issues.push({
            id: buildIssueId('SUBNETWORK_IP_NETWORK_MISMATCH', `${entry.path}:net:${network}`),
            severity: 'warn',
            category: 'interop',
            code: 'SUBNETWORK_IP_NETWORK_MISMATCH',
            message: `ConnectedAP '${entry.iedName}/${entry.apName}' has IP ${entry.ip} in ${network}, expected ${dominant} for SubNetwork '${subnet.name}'.`,
            path: entry.path,
            protocol: 'Generic',
            context: { iedName: entry.iedName, apName: entry.apName, ip: entry.ip },
            entityRef: { type: 'ConnectedAP', id: `cap:${subnet.name}:${entry.iedName}:${entry.apName}`, iedName: entry.iedName },
            resolved: false,
            fixHint: `Move this endpoint to the same IP subnet (${dominant}) as the rest of SubNetwork '${subnet.name}'.`,
          });
        }
      }
    }
  }

  return issues;
}

function normalizeIp(value: string): string {
  return value.trim();
}

function ipv4Network24(ip: string): string | undefined {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) {
    return undefined;
  }
  const octets = m.slice(1).map((s) => Number(s));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return undefined;
  }
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}
