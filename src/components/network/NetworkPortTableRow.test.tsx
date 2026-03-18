import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkPortTableRow } from './NetworkPortTable';

describe('NetworkPortTableRow', () => {
  it('renders row snapshot', () => {
    const { container } = render(
      <NetworkPortTableRow
        row={{
          key: 'IED_A::P1',
          iedName: 'IED_A',
          apName: 'P1',
          bayLabel: 'Bay_A',
          ldeviceLabel: 'LD0',
          deviceType: 'F',
          gooseOut: 3,
          gooseIn: 1,
          svOut: 2,
          svIn: 0,
          reportOut: 1,
          reportIn: 4,
          unresolvedCount: 2,
          probableCount: 1,
          resolvedCount: 8,
          totalTraffic: 11,
          health: 'unresolved',
        }}
        selected={true}
        onClick={() => undefined}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
