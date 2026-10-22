import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreatorEarningsHero } from '../CreatorEarningsHero';

describe('CreatorEarningsHero', () => {
  const defaultProps = {
    firstName: 'Jane',
    totalEarnings: 15000,
    balance: 5000,
    availableBalance: 4000,
    clearingBalance: 1000,
    nextAvailableAt: '2026-10-25T10:00:00Z',
    isClearing: true,
    monthEarnings: 3000,
    monthSales: 12,
    monthClicks: 150,
    referralLink: 'https://byblos.co.ke/seller/register?ref=JANE123',
    onCopyLink: vi.fn(),
    onGoToWithdraw: vi.fn()
  };

  it('renders lifetime KSh 3 seller referral royalty text', () => {
    render(<CreatorEarningsHero {...defaultProps} />);

    expect(screen.getByText('Seller invite link')).toBeInTheDocument();
    expect(screen.getByText(/KSh 3 per sale, for life/i)).toBeInTheDocument();
  });

  it('renders updated 1%–30% seller-set commission rate text in how it works breakdown', () => {
    render(<CreatorEarningsHero {...defaultProps} />);

    // Open "How it works" accordion
    const toggleBtn = screen.getByRole('button', { name: /how it works — two ways to earn/i });
    fireEvent.click(toggleBtn);

    // Verify KSh 3 per sale on seller referrals
    expect(screen.getByText(/You earn: a fixed KSh 3 on every product they sell./i)).toBeInTheDocument();

    // Verify updated 1%–30% commission rate wording
    expect(screen.getByText(/You earn: a commission rate set by the seller \(1%–30% per sale\)\./i)).toBeInTheDocument();
  });
});
