import type { LandsnetValidationReport } from '../validation/landsnet/types';

export interface JsonExportFile {
  fileName: string;
  content: string;
  mime: string;
}

export function landsnetJsonFiles(report: LandsnetValidationReport): JsonExportFile[] {
  return [
    {
      fileName: 'validation_results.json',
      content: JSON.stringify(
        {
          profile: report.profile,
          generatedAt: report.generatedAt,
          totals: report.totals,
          checks: report.checks,
          detailedIssues: report.issues,
        },
        null,
        2,
      ),
      mime: 'application/json',
    },
    {
      fileName: 'out_MMS.json',
      content: JSON.stringify(report.outputs.out_MMS, null, 2),
      mime: 'application/json',
    },
    {
      fileName: 'out_MMS_datasets.json',
      content: JSON.stringify(report.outputs.out_MMS_datasets, null, 2),
      mime: 'application/json',
    },
    {
      fileName: 'out_goose.json',
      content: JSON.stringify(report.outputs.out_goose, null, 2),
      mime: 'application/json',
    },
    {
      fileName: 'out_goose_datasets.json',
      content: JSON.stringify(report.outputs.out_goose_datasets, null, 2),
      mime: 'application/json',
    },
    {
      fileName: 'out_sv.json',
      content: JSON.stringify(report.outputs.out_sv, null, 2),
      mime: 'application/json',
    },
    {
      fileName: 'IEDs_SW_filter_template.json',
      content: JSON.stringify(report.outputs.ieds_sw_filter_template, null, 2),
      mime: 'application/json',
    },
    {
      fileName: 'landsnet_dictionaries.json',
      content: JSON.stringify(report.dictionaries, null, 2),
      mime: 'application/json',
    },
  ];
}
