import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminWithdrawalsTab } from '../AdminWithdrawalsTab';
import { AdminSellersTab } from '../AdminSellersTab';
import { AdminCreatorsTab } from '../AdminCreatorsTab';
import { AdminBuyersTab } from '../AdminBuyersTab';

const EMPTY_PAGINATION = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

function assertSearchInputNotBlocked(ariaLabel: string, onSearchChange: ReturnType<typeof vi.fn>) {
  const input = screen.getByRole('textbox', { name: ariaLabel });
  const wrapper = input.parentElement;
  expect(wrapper).not.toBeNull();

  // Input must create a positioned stacking layer above sibling decorative elements
  expect(input.className).toContain('relative');
  expect(input.className).toContain('z-10');

  // Sibling glow overlay and Search icon must not intercept pointer events
  const siblings = Array.from(wrapper!.children).filter((el) => el !== input);
  expect(siblings.length).toBeGreaterThan(0);
  for (const sibling of siblings) {
    expect(sibling.getAttribute('class') ?? '').toContain('pointer-events-none');
  }

  fireEvent.change(input, { target: { value: 'test-query' } });
  expect(onSearchChange).toHaveBeenCalledWith('test-query');
}

describe('Admin tab search inputs', () => {
  it('AdminWithdrawalsTab search input is interactive and not covered by glow overlay', () => {
    const onSearchChange = vi.fn();
    render(
      <AdminWithdrawalsTab
        withdrawalRequests={[]}
        searchQuery=""
        onSearchChange={onSearchChange}
        pagination={EMPTY_PAGINATION}
        onPageChange={vi.fn()}
        activeOrders={0}
        pendingPayoutCount={0}
        pendingPayoutAmount={0}
        providerHealth={null}
        providerHealthOk={true}
        providerHealthAvailable={true}
        formatProviderBalance={() => 'KES 0.00'}
        formatDate={(d) => d || ''}
        onAction={vi.fn()}
        processingRequestId={null}
      />
    );

    assertSearchInputNotBlocked('Search payouts', onSearchChange);
  });

  it('AdminSellersTab search input is interactive and not covered by glow overlay', () => {
    const onSearchChange = vi.fn();
    render(
      <AdminSellersTab
        sellers={[]}
        searchQuery=""
        onSearchChange={onSearchChange}
        pagination={EMPTY_PAGINATION}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
      />
    );

    assertSearchInputNotBlocked('Search sellers', onSearchChange);
  });

  it('AdminCreatorsTab search input is interactive and not covered by glow overlay', () => {
    const onSearchChange = vi.fn();
    render(
      <AdminCreatorsTab
        creators={[]}
        searchQuery=""
        onSearchChange={onSearchChange}
        pagination={EMPTY_PAGINATION}
        onPageChange={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
        totalCreatorSales={0}
        totalCreatorLinkClicks={0}
        totalCreatorEarnings={0}
      />
    );

    assertSearchInputNotBlocked('Search creators', onSearchChange);
  });

  it('AdminBuyersTab search input is interactive and not covered by glow overlay', () => {
    const onSearchChange = vi.fn();
    render(
      <AdminBuyersTab
        buyers={[]}
        searchQuery=""
        onSearchChange={onSearchChange}
        pagination={EMPTY_PAGINATION}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
        formatDate={(d) => d || ''}
      />
    );

    assertSearchInputNotBlocked('Search buyers', onSearchChange);
  });
});

