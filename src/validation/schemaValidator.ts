import type { ValidationIssue } from './types';
import { validateXML } from 'xmllint-wasm';

// Edition 2 (2007B) — most common, no 'release' attribute on SCL element
import sclXsd2007b from '../../public/schemas/scl2007b/SCL.xsd?raw';
import sclBaseSimpleTypes2007b from '../../public/schemas/scl2007b/SCL_BaseSimpleTypes.xsd?raw';
import sclBaseTypes2007b from '../../public/schemas/scl2007b/SCL_BaseTypes.xsd?raw';
import sclCommunication2007b from '../../public/schemas/scl2007b/SCL_Communication.xsd?raw';
import sclDataTypeTemplates2007b from '../../public/schemas/scl2007b/SCL_DataTypeTemplates.xsd?raw';
import sclEnums2007b from '../../public/schemas/scl2007b/SCL_Enums.xsd?raw';
import sclIed2007b from '../../public/schemas/scl2007b/SCL_IED.xsd?raw';
import sclSubstation2007b from '../../public/schemas/scl2007b/SCL_Substation.xsd?raw';

// Edition 2.1 (2007B4) — requires 'release' attribute on SCL element
import sclXsd2007b4 from '../../public/schemas/scl2007b4/SCL.xsd?raw';
import sclBaseSimpleTypes2007b4 from '../../public/schemas/scl2007b4/SCL_BaseSimpleTypes.xsd?raw';
import sclBaseTypes2007b4 from '../../public/schemas/scl2007b4/SCL_BaseTypes.xsd?raw';
import sclCommunication2007b4 from '../../public/schemas/scl2007b4/SCL_Communication.xsd?raw';
import sclDataTypeTemplates2007b4 from '../../public/schemas/scl2007b4/SCL_DataTypeTemplates.xsd?raw';
import sclEnums2007b4 from '../../public/schemas/scl2007b4/SCL_Enums.xsd?raw';
import sclIed2007b4 from '../../public/schemas/scl2007b4/SCL_IED.xsd?raw';
import sclSubstation2007b4 from '../../public/schemas/scl2007b4/SCL_Substation.xsd?raw';

const SCHEMAS_2007B = [
  { fileName: 'SCL.xsd', contents: sclXsd2007b },
  { fileName: 'SCL_BaseSimpleTypes.xsd', contents: sclBaseSimpleTypes2007b },
  { fileName: 'SCL_BaseTypes.xsd', contents: sclBaseTypes2007b },
  { fileName: 'SCL_Communication.xsd', contents: sclCommunication2007b },
  { fileName: 'SCL_DataTypeTemplates.xsd', contents: sclDataTypeTemplates2007b },
  { fileName: 'SCL_Enums.xsd', contents: sclEnums2007b },
  { fileName: 'SCL_IED.xsd', contents: sclIed2007b },
  { fileName: 'SCL_Substation.xsd', contents: sclSubstation2007b },
];

const SCHEMAS_2007B4 = [
  { fileName: 'SCL.xsd', contents: sclXsd2007b4 },
  { fileName: 'SCL_BaseSimpleTypes.xsd', contents: sclBaseSimpleTypes2007b4 },
  { fileName: 'SCL_BaseTypes.xsd', contents: sclBaseTypes2007b4 },
  { fileName: 'SCL_Communication.xsd', contents: sclCommunication2007b4 },
  { fileName: 'SCL_DataTypeTemplates.xsd', contents: sclDataTypeTemplates2007b4 },
  { fileName: 'SCL_Enums.xsd', contents: sclEnums2007b4 },
  { fileName: 'SCL_IED.xsd', contents: sclIed2007b4 },
  { fileName: 'SCL_Substation.xsd', contents: sclSubstation2007b4 },
];

/** Detect SCL edition from the raw XML: 2007B4 has release="..." on the SCL element */
function detectEdition(rawXml: string): '2007B4' | '2007B' {
  const header = rawXml.slice(0, 2000);
  return /\brelease\s*=/.test(header) ? '2007B4' : '2007B';
}

const WASM_OPTIONS = {
  initialMemoryPages: 2048,  // 128 MiB
  maxMemoryPages: 8192,      // 512 MiB
};

export async function runSchemaValidation(rawXml: string): Promise<ValidationIssue[]> {
  try {
    const edition = detectEdition(rawXml);
    const schemas = edition === '2007B4' ? SCHEMAS_2007B4 : SCHEMAS_2007B;
    const [mainSchema, ...preloadSchemas] = schemas;

    const result = await validateXML({
      xml: [{ fileName: 'input.scd', contents: rawXml }],
      schema: [mainSchema],
      preload: preloadSchemas,
      ...WASM_OPTIONS,
    });

    if (result.valid) return [];

    return result.errors.map((err, i) => {
      const line = err.loc?.lineNumber;
      return {
        id: `scl-xsd:${i}`,
        severity: 'error' as const,
        category: 'syntax' as const,
        code: 'SCL_XSD_001',
        message: err.message,
        path: line ? `/SCL (line ${line})` : '/SCL',
        protocol: 'Generic' as const,
        context: {},
        entityRef: { type: 'Unknown' as const, id: `scl-xsd:${i}` },
        resolved: false,
        fixHint: `Fix XML structure to conform to IEC 61850-6 SCL schema (Edition ${edition}).`,
      };
    });
  } catch (e) {
    return [
      {
        id: 'scl-xsd:error',
        severity: 'warn' as const,
        category: 'syntax' as const,
        code: 'SCL_XSD_ERR',
        message: `Schema validation error: ${e instanceof Error ? e.message : String(e)}`,
        path: '/SCL',
        protocol: 'Generic' as const,
        context: {},
        entityRef: { type: 'Unknown' as const, id: 'scl-xsd:error' },
        resolved: false,
      },
    ];
  }
}
