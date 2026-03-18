import type { ValidationIssue } from './types';

// MVP: schema validator placeholder. Browser XSD validation can be added with a WASM validator.
export async function runSchemaValidation(): Promise<ValidationIssue[]> {
  return [
    {
      id: 'schema:not-available',
      severity: 'info',
      category: 'syntax',
      code: 'SCL_XSD_000',
      message: 'Schema validation is not available in this MVP build.',
      path: '/SCL',
      protocol: 'Generic',
      context: {},
      entityRef: { type: 'Unknown', id: '/SCL' },
      resolved: false,
      fixHint: 'Enable XSD validator module and provide SCL schema files in public/xsd.',
    },
  ];
}
