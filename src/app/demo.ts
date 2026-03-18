import { DiagnosticsStore } from '../diagnostics/store';
import { DiagnosticsUI } from '../diagnostics/ui';
import { runExampleValidators, type ValidatorRunResult } from '../validators/example';

export interface DiagnosticsDemoOptions {
  mount: HTMLElement;
  root?: EventTarget;
  validatorNames?: Record<string, string>;
}

export interface DiagnosticsDemo {
  store: DiagnosticsStore;
  run: (xml: string) => ValidatorRunResult;
  destroy: () => void;
}

// Demo wiring: current-state diagnostics pane + validators runner.
export function createDiagnosticsDemo(options: DiagnosticsDemoOptions): DiagnosticsDemo {
  const store = new DiagnosticsStore();
  const root = options.root ?? document.body;
  const ui = new DiagnosticsUI({
    root,
    container: options.mount,
    store,
    title: 'Diagnostics',
    validatorNames: options.validatorNames,
  });

  return {
    store,
    run: (xml: string) => runExampleValidators(xml, { store, eventTarget: root }),
    destroy: () => ui.destroy(),
  };
}
