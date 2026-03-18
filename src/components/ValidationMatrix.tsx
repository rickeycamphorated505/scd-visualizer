import { useEffect, useMemo, useRef, useState } from 'react';
import type { SclModel } from '../model/types';
import type { LandsnetValidationReport } from '../validation/landsnet/types';

const COLUMN_VIRTUALIZE_THRESHOLD = 40;

interface ValidationMatrixProps {
  model: SclModel;
  landsnetReport: LandsnetValidationReport | null | undefined;
  selectedIedName?: string;
  onSelectIed: (iedName: string) => void;
}

export default function ValidationMatrix({
  model,
  landsnetReport,
  selectedIedName,
  onSelectIed,
}: ValidationMatrixProps): JSX.Element {
  const iedNames = useMemo(
    () => [...model.ieds].sort((a, b) => a.name.localeCompare(b.name)).map((i) => i.name),
    [model.ieds],
  );

  const checks = useMemo(() => landsnetReport?.checks ?? [], [landsnetReport]);

  // Map: checkCode → iedName → failCount
  const cellData = useMemo(() => {
    if (!landsnetReport) return new Map<string, Map<string, number>>();
    const map = new Map<string, Map<string, number>>();
    for (const check of landsnetReport.checks) {
      map.set(check.code, new Map<string, number>());
    }
    for (const issue of landsnetReport.issues) {
      const checkMap = map.get(issue.code);
      if (!checkMap) continue;
      const iedName = issue.entityRef.iedName ?? issue.context.iedName ?? '__global__';
      checkMap.set(iedName, (checkMap.get(iedName) ?? 0) + 1);
    }
    return map;
  }, [landsnetReport]);

  // Column virtualization: track which column indices are visible
  const shouldVirtualize = iedNames.length > COLUMN_VIRTUALIZE_THRESHOLD;
  const [visibleCols, setVisibleCols] = useState<Set<number>>(new Set());
  const headerThRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  useEffect(() => {
    if (!shouldVirtualize) {
      return;
    }

    const observers: IntersectionObserver[] = [];

    iedNames.forEach((_, colIdx) => {
      const el = headerThRefs.current[colIdx];
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            setVisibleCols((prev) => {
              const next = new Set(prev);
              if (entry.isIntersecting) {
                next.add(colIdx);
              } else {
                next.delete(colIdx);
              }
              return next;
            });
          });
        },
        { threshold: 0 },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [iedNames, shouldVirtualize]);

  if (!landsnetReport) {
    return (
      <div className="validation-matrix-empty">
        <p className="hint">No validation results. Load an SCD file to run checks.</p>
      </div>
    );
  }

  return (
    <div className="validation-matrix-wrap">
      <div className="validation-matrix-scroll">
        <table className="validation-matrix-table">
          <thead>
            <tr>
              <th className="vm-check-col">Check</th>
              <th className="vm-title-col">Title</th>
              <th className="vm-global-col">Global</th>
              {iedNames.map((name, colIdx) => (
                <th
                  key={name}
                  ref={(el) => {
                    headerThRefs.current[colIdx] = el;
                  }}
                  className={`vm-ied-col ${selectedIedName === name ? 'vm-ied-selected' : ''}`}
                  title={name}
                >
                  <button className="vm-ied-header-btn" onClick={() => onSelectIed(name)}>
                    {name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => {
              const checkMap = cellData.get(check.code);
              const globalCount = checkMap?.get('__global__') ?? 0;
              return (
                <tr key={check.code} className={`vm-row ${!check.passed ? 'vm-row-fail' : ''}`}>
                  <td className="vm-code-cell">
                    <span
                      className={`vm-code-badge ${check.code.startsWith('IEC_') ? 'vm-iec' : 'vm-lnet'}`}
                    >
                      {check.code}
                    </span>
                  </td>
                  <td className="vm-title-cell">{check.title}</td>
                  <td className="vm-global-cell">
                    <CellBadge
                      count={globalCount}
                      hasData={check.issueCount > 0 || check.passed}
                      isGlobal
                    />
                  </td>
                  {iedNames.map((iedName, colIdx) => {
                    const isVisible =
                      !shouldVirtualize ||
                      visibleCols.has(colIdx) ||
                      selectedIedName === iedName;
                    if (!isVisible) {
                      return (
                        <td
                          key={iedName}
                          className={`vm-ied-cell vm-placeholder ${selectedIedName === iedName ? 'vm-ied-selected' : ''}`}
                        />
                      );
                    }
                    const count = checkMap?.get(iedName) ?? 0;
                    return (
                      <td
                        key={iedName}
                        className={`vm-ied-cell ${selectedIedName === iedName ? 'vm-ied-selected' : ''}`}
                      >
                        <CellBadge count={count} hasData />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellBadge({
  count,
  hasData,
  isGlobal = false,
}: {
  count: number;
  hasData: boolean;
  isGlobal?: boolean;
}): JSX.Element {
  if (!hasData) {
    return <span className="vm-cell vm-na">—</span>;
  }
  if (count === 0) {
    return <span className="vm-cell vm-pass">{isGlobal ? '✓' : '·'}</span>;
  }
  return <span className="vm-cell vm-fail">{count}</span>;
}
