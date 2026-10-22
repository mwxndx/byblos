import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectionTitle } from '../SectionTitle';

describe('SectionTitle', () => {
  it('renders title when passed as prop with subtitle', () => {
    render(<SectionTitle title="Top Performing Shops" subtitle="Highest GMV sellers this month" />);

    expect(screen.getByText('Top Performing Shops')).toBeInTheDocument();
    expect(screen.getByText('Highest GMV sellers this month')).toBeInTheDocument();
  });

  it('renders children when passed as node', () => {
    render(
      <SectionTitle subtitle="Recent platform activity">
        <span>Live Activity Log</span>
      </SectionTitle>
    );

    expect(screen.getByText('Live Activity Log')).toBeInTheDocument();
    expect(screen.getByText('Recent platform activity')).toBeInTheDocument();
  });
});
