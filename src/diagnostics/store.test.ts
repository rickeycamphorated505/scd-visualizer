import { describe, expect, it, vi } from 'vitest';
import { DiagnosticsStore } from './store';

describe('DiagnosticsStore', () => {
  it('setIssues replaces current issues for validator', () => {
    const store = new DiagnosticsStore();

    store.setIssues('schema', [{ validatorId: 'schema', title: 'A' }]);
    store.setIssues('schema', [{ validatorId: 'schema', title: 'B' }]);

    const snapshot = store.getSnapshot();
    expect(snapshot.get('schema')).toEqual([{ validatorId: 'schema', title: 'B' }]);
  });

  it('clearIssues and clearAll remove current state', () => {
    const store = new DiagnosticsStore();

    store.setIssues('schema', [{ validatorId: 'schema', title: 'S1' }]);
    store.setIssues('templates', [{ validatorId: 'templates', title: 'T1' }]);

    store.clearIssues('schema');
    let snapshot = store.getSnapshot();
    expect(snapshot.has('schema')).toBe(false);
    expect(snapshot.has('templates')).toBe(true);

    store.clearAll();
    snapshot = store.getSnapshot();
    expect(snapshot.size).toBe(0);
  });

  it('subscribe emits current snapshot and supports unsubscribe', () => {
    const store = new DiagnosticsStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);

    store.setIssues('schema', [{ validatorId: 'schema', title: 'S1' }]);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.setIssues('schema', [{ validatorId: 'schema', title: 'S2' }]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
