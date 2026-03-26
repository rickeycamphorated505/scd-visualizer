import { useEffect, useRef, useState } from 'react';
import type { SclModel } from '../model/types';
import type { LandsnetValidationReport } from '../validation/landsnet/types';
import { runValidation } from '../validation/runValidation';
import { runLandsnetValidation } from '../validation/landsnet/runLandsnetValidation';
import { runSchemaValidation } from '../validation/schemaValidator';
import type { Dispatch } from 'react';
import type { ValidationAction } from './validationStore';

export function useModelValidation(
  model: SclModel | undefined,
  dispatch: Dispatch<ValidationAction>,
  rawXml?: string,
): LandsnetValidationReport | undefined {
  const [landsnetReport, setLandsnetReport] = useState<LandsnetValidationReport | undefined>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!model) {
      dispatch({ type: 'reset' });
      setLandsnetReport(undefined);
      return () => { cancelled = true; };
    }

    timerRef.current = setTimeout(() => {
      const structuralIssues = runValidation(model);
      const schemaIssues = rawXml ? runSchemaValidation(rawXml) : Promise.resolve([]);

      void Promise.all([structuralIssues, schemaIssues]).then(([structural, schema]) => {
        if (cancelled) return;
        dispatch({ type: 'set-issues', payload: [...structural, ...schema] });
        setLandsnetReport(runLandsnetValidation(model));
      });
    }, 300);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [model, rawXml, dispatch]);

  return landsnetReport;
}
