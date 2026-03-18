import type { ParseErrorInfo } from '../model/types';

export interface XmlNode {
  element: Element;
  key: string;
}

export function parseXml(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parserError = doc.querySelector('parsererror');

  if (parserError) {
    const raw = parserError.textContent?.trim() || 'Unknown XML parsing error';
    const info = extractLineColumn(raw);
    const error = new Error(raw) as Error & { info?: ParseErrorInfo };
    error.info = {
      message: raw,
      line: info.line,
      column: info.column,
    };
    throw error;
  }

  return doc;
}

export function getAttr(el: Element, attr: string): string | undefined {
  const value = el.getAttribute(attr);
  return value === null ? undefined : value;
}

/** Finnur attribute eftir localName (virkar með namespace); case-insensitive. */
export function getAttrByLocalName(el: Element, localName: string): string | undefined {
  const want = localName.toLowerCase();
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (a.localName?.toLowerCase() === want || a.name?.toLowerCase() === want) {
      const v = a.value?.trim();
      if (v !== '') return v;
    }
  }
  return undefined;
}

export function childrenByTag(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter((child) => child.tagName === tagName);
}

/** Same as childrenByTag but matches by localName (works with XML namespace). */
export function childrenByTagLocal(parent: Element, localName: string): Element[] {
  const want = localName.toLowerCase();
  return Array.from(parent.children).filter(
    (child) => (child.localName || child.tagName).toLowerCase() === want
  );
}

export function firstByTag(parent: Element, tagName: string): Element | undefined {
  return childrenByTag(parent, tagName)[0];
}

export function snippetFor(el: Element): string {
  return new XMLSerializer().serializeToString(el);
}

function extractLineColumn(message: string): { line?: number; column?: number } {
  const lineMatch = message.match(/line\s+(\d+)/i);
  const columnMatch = message.match(/column\s+(\d+)/i);
  return {
    line: lineMatch ? Number(lineMatch[1]) : undefined,
    column: columnMatch ? Number(columnMatch[1]) : undefined,
  };
}
