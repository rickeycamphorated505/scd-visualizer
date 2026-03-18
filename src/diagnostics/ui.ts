import { ISSUE_EVENT_NAME } from './events';
import { DiagnosticsStore } from './store';
import type { IssueDetail } from './types';

export interface DiagnosticsUIOptions {
  root: EventTarget;
  container: HTMLElement;
  store?: DiagnosticsStore;
  title?: string;
  validatorNames?: Record<string, string>;
}

const STYLE_ID = 'diagnostics-ui-style';

// Framework-agnostic Diagnostics view that mirrors OpenSCD grouping by validatorId.
export class DiagnosticsUI {
  private readonly root: EventTarget;
  private readonly container: HTMLElement;
  private readonly store: DiagnosticsStore;
  private readonly validatorNames: Record<string, string>;
  private readonly heading: string;

  private readonly panelEl: HTMLDivElement;
  private readonly countEl: HTMLSpanElement;
  private readonly filterEl: HTMLSelectElement;
  private readonly listEl: HTMLDivElement;
  private unsubscribe: (() => void) | null = null;
  private selectedValidatorId = 'all';

  private readonly issueEventHandler = (event: Event): void => {
    const customEvent = event as CustomEvent<IssueDetail>;
    if (!customEvent.detail) {
      return;
    }

    const detail = customEvent.detail;
    if (!detail.validatorId || !detail.title) {
      return;
    }

    const snapshot = this.store.getSnapshot();
    const current = snapshot.get(detail.validatorId) ?? [];
    const merged = dedupeIssues([...current, detail]);
    this.store.setIssues(detail.validatorId, merged);
  };

  constructor(options: DiagnosticsUIOptions) {
    this.root = options.root;
    this.container = options.container;
    this.store = options.store ?? new DiagnosticsStore();
    this.validatorNames = options.validatorNames ?? {};
    this.heading = options.title ?? 'Diagnostics';

    ensureStyles();

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'diag-panel';

    const headerEl = document.createElement('div');
    headerEl.className = 'diag-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'diag-title-wrap';

    const titleEl = document.createElement('h3');
    titleEl.textContent = this.heading;
    titleEl.className = 'diag-title';

    this.countEl = document.createElement('span');
    this.countEl.className = 'diag-count';

    titleWrap.append(titleEl, this.countEl);

    const controlsEl = document.createElement('div');
    controlsEl.className = 'diag-controls';

    this.filterEl = document.createElement('select');
    this.filterEl.className = 'diag-filter';
    this.filterEl.addEventListener('change', () => {
      this.selectedValidatorId = this.filterEl.value;
      this.render();
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'diag-btn';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', () => {
      this.store.clearAll();
    });

    controlsEl.append(this.filterEl, clearBtn);
    headerEl.append(titleWrap, controlsEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'diag-list';

    this.panelEl.append(headerEl, this.listEl);
    this.container.replaceChildren(this.panelEl);

    this.root.addEventListener(ISSUE_EVENT_NAME, this.issueEventHandler as EventListener);
    this.unsubscribe = this.store.subscribe(() => {
      this.render();
    });
  }

  getStore(): DiagnosticsStore {
    return this.store;
  }

  destroy(): void {
    this.root.removeEventListener(ISSUE_EVENT_NAME, this.issueEventHandler as EventListener);
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.container.replaceChildren();
  }

  private render(): void {
    const snapshot = this.store.getSnapshot();
    const validatorIds = Array.from(snapshot.keys()).sort((a, b) => a.localeCompare(b));

    if (this.selectedValidatorId !== 'all' && !snapshot.has(this.selectedValidatorId)) {
      this.selectedValidatorId = 'all';
    }

    this.renderFilterOptions(validatorIds);

    const selectedIds = this.selectedValidatorId === 'all' ? validatorIds : validatorIds.filter((id) => id === this.selectedValidatorId);

    const fragment = document.createDocumentFragment();
    let totalIssues = 0;

    for (const validatorId of selectedIds) {
      const issues = snapshot.get(validatorId) ?? [];
      totalIssues += issues.length;

      const groupEl = document.createElement('section');
      groupEl.className = 'diag-group';

      const headingEl = document.createElement('h4');
      headingEl.className = 'diag-group-title';
      headingEl.textContent = this.getValidatorLabel(validatorId);
      groupEl.appendChild(headingEl);

      const listEl = document.createElement('ul');
      listEl.className = 'diag-group-list';

      for (const issue of issues) {
        const itemEl = document.createElement('li');
        itemEl.className = 'diag-item';

        const titleRow = document.createElement('div');
        titleRow.className = 'diag-item-title-row';

        const titleEl = document.createElement('span');
        titleEl.className = 'diag-item-title';
        titleEl.textContent = issue.title;
        titleRow.appendChild(titleEl);

        if (issue.severity) {
          const sevEl = document.createElement('span');
          sevEl.className = `diag-severity diag-severity-${issue.severity}`;
          sevEl.textContent = issue.severity;
          titleRow.appendChild(sevEl);
        }

        itemEl.appendChild(titleRow);

        if (issue.message) {
          const msgEl = document.createElement('p');
          msgEl.className = 'diag-item-message';
          msgEl.textContent = issue.message;
          itemEl.appendChild(msgEl);
        }

        listEl.appendChild(itemEl);
      }

      groupEl.appendChild(listEl);
      fragment.appendChild(groupEl);
    }

    if (totalIssues === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'diag-empty';
      emptyEl.textContent = 'No issues for current filter.';
      fragment.appendChild(emptyEl);
    }

    this.countEl.textContent = `${totalIssues} issue${totalIssues === 1 ? '' : 's'}`;
    this.listEl.replaceChildren(fragment);
  }

  private renderFilterOptions(validatorIds: string[]): void {
    const options: Array<{ value: string; label: string }> = [{ value: 'all', label: 'All validators' }];
    for (const validatorId of validatorIds) {
      options.push({ value: validatorId, label: this.getValidatorLabel(validatorId) });
    }

    this.filterEl.replaceChildren();
    for (const option of options) {
      const optionEl = document.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      optionEl.selected = option.value === this.selectedValidatorId;
      this.filterEl.appendChild(optionEl);
    }
  }

  private getValidatorLabel(validatorId: string): string {
    return this.validatorNames[validatorId] ?? validatorId;
  }
}

function dedupeIssues(issues: IssueDetail[]): IssueDetail[] {
  const map = new Map<string, IssueDetail>();
  for (const issue of issues) {
    const key = `${issue.validatorId}::${issue.title}::${issue.message || ''}::${issue.severity || ''}`;
    map.set(key, issue);
  }
  return Array.from(map.values());
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    .diag-panel { font: 13px/1.4 system-ui, sans-serif; border: 1px solid #d8dee8; border-radius: 8px; background: #fff; }
    .diag-header { display: flex; justify-content: space-between; gap: 8px; padding: 10px; border-bottom: 1px solid #e5e9f0; }
    .diag-title-wrap { display: flex; align-items: baseline; gap: 8px; }
    .diag-title { margin: 0; font-size: 14px; }
    .diag-count { color: #667085; }
    .diag-controls { display: flex; gap: 8px; align-items: center; }
    .diag-filter { min-width: 160px; }
    .diag-btn { border: 1px solid #c8d0db; background: #f8fafc; padding: 5px 10px; border-radius: 6px; cursor: pointer; }
    .diag-list { max-height: 360px; overflow: auto; padding: 8px 10px; }
    .diag-group { margin: 0 0 10px; }
    .diag-group-title { margin: 6px 0; font-size: 13px; color: #344054; }
    .diag-group-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
    .diag-item { border: 1px solid #e4e7ec; border-radius: 6px; padding: 8px; background: #fcfcfd; }
    .diag-item-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .diag-item-title { font-weight: 600; }
    .diag-item-message { margin: 4px 0 0; color: #475467; }
    .diag-severity { text-transform: uppercase; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px; }
    .diag-severity-error { background: #fee4e2; color: #b42318; }
    .diag-severity-warning { background: #fef0c7; color: #b54708; }
    .diag-severity-info { background: #e0f2fe; color: #075985; }
    .diag-empty { margin: 0; color: #667085; }
  `;

  document.head.appendChild(styleEl);
}
