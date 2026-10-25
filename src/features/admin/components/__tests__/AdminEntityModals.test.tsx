import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminEntityModals } from '../AdminEntityModals';
import type { AdminBuyer } from '../../types/dashboard';

describe('AdminEntityModals — Customer Intelligence Report', () => {
  const deletedBuyer: AdminBuyer = {
    id: 24,
    user_id: 38,
    name: 'Deleted user',
    email: 'deleted_buyer_38_1792922180992@deleted.byblos',
    phone: '—',
    status: 'deleted',
    city: 'N/A',
    location: 'N/A',
    createdAt: '2026-10-24T12:00:00Z',
  };

  it('renders deleted buyer status with red badge and not green active badge', () => {
    render(
      <AdminEntityModals
        selectedSeller={null}
        isLoadingSeller={false}
        closeSellerModal={vi.fn()}
        selectedBuyer={deletedBuyer}
        isLoadingBuyer={false}
        closeBuyerModal={vi.fn()}
        safeFormatDate={(d) => String(d || '—')}
      />
    );

    expect(screen.getByText('Customer Intelligence Report')).toBeInTheDocument();
    expect(screen.getAllByText('Deleted user').length).toBeGreaterThanOrEqual(1);

    const statusBadge = screen.getByText('deleted');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge.className).toContain('text-red-400');
    expect(statusBadge.className).not.toContain('text-green-400');
  });

  it('renders active buyer status with green badge', () => {
    const activeBuyer: AdminBuyer = {
      ...deletedBuyer,
      status: 'active',
      name: 'Active Buyer',
    };

    render(
      <AdminEntityModals
        selectedSeller={null}
        isLoadingSeller={false}
        closeSellerModal={vi.fn()}
        selectedBuyer={activeBuyer}
        isLoadingBuyer={false}
        closeBuyerModal={vi.fn()}
        safeFormatDate={(d) => String(d || '—')}
      />
    );

    const statusBadge = screen.getByText('active');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge.className).toContain('text-green-400');
  });
});
