export function buildIssueId(code: string, path: string): string {
  const input = `${code}|${path}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${code}:${Math.abs(h)}`;
}
