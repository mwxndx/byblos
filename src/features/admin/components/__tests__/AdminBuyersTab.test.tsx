import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBuyersTab } from '../AdminBuyersTab';
import type { AdminBuyer, PaginationMeta } from '../../types/dashboard';

describe('AdminBuyersTab', () => {
  const mockPagination: PaginationMeta = {
    page: 1,
    pageSize: 10,
    total: 2,
    hasMore: false,
  };

  const mockBuyers: AdminBuyer[] = [
    {
      id: 1,
      user_id: 101,
      name: 'Alice Buyer',
      email: 'alice@example.com',
      phone: '0712345678',
      status: 'active',
      city: 'Nairobi',
      location: 'Kilimani',
      createdAt: '2026-10-01T12:00:00Z',
    },
    {
      id: 24,
      user_id: 38,
      name: 'Deleted user',
      email: 'deleted_buyer_38_1792922180992@deleted.byblos',
      phone: '—',
      status: 'deleted',
      city: 'N/A',
      location: 'N/A',
      createdAt: '2026-10-24T12:00:00Z',
    },
  ];

  it('renders active and deleted buyers with accurate status badges and action states', () => {
    render(
      <AdminBuyersTab
        buyers={mockBuyers}
        searchQuery=""
        onSearchChange={vi.fn()}
        pagination={mockPagination}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
        formatDate={(d) => String(d || '—')}
      />
    );

    // Active buyer assertions
    expect(screen.getByText('Alice Buyer')).toBeInTheDocument();
    const activeBadge = screen.getByText('active');
    expect(activeBadge).toBeInTheDocument();
    expect(activeBadge.className).toContain('text-green-400');

    // Deleted buyer assertions
    expect(screen.getByText('Deleted user')).toBeInTheDocument();
    const deletedBadge = screen.getByText('deleted');
    expect(deletedBadge).toBeInTheDocument();
    expect(deletedBadge.className).toContain('text-red-400');

    // Delete button assertions (strict regex matching to distinguish "Delete" from "Deleted")
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    expect(deleteBtn).not.toBeDisabled();

    const deletedBtn = screen.getByRole('button', { name: /^deleted$/i });
    expect(deletedBtn).toBeDisabled();
  });
});
