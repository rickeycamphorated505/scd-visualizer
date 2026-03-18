import { useEffect, useRef, useState } from 'react';
import type { SclModel } from '../model/types';
import type { LandsnetValidationReport } from '../validation/landsnet/types';
import { runValidation } from '../validation/runValidation';
import { runLandsnetValidation } from '../validation/landsnet/runLandsnetValidation';
import type { Dispatch } from 'react';
import type { ValidationAction } from './validationStore';

export function useModelValidation(
  model: SclModel | undefined,
  dispatch: Dispatch<ValidationAction>,
): LandsnetValidationReport | undefined {
  const [landsnetReport, setLandsnetReport] = useState<LandsnetValidationReport | undefined>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!model) {
      dispatch({ type: 'reset' });
      setLandsnetReport(undefined);
      return;
    }

    timerRef.current = setTimeout(() => {
      let cancelled = false;

      void runValidation(model).then((issues) => {
        if (cancelled) {
          return;
        }
        dispatch({ type: 'set-issues', payload: issues });
        setLandsnetReport(runLandsnetValidation(model));
      });

      return () => {
        cancelled = true;
      };
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [model, dispatch]);

  return landsnetReport;
}

