import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifyEmailModalView } from '@/features/auth/components/VerifyEmailModalView';
import { RefundConfirmDialog } from '@/features/buyer/components/RefundConfirmDialog';
import { OrderDetailsDialog } from '@/features/orders/components/OrderDetailsDialog';
import { IosNotificationBanner } from '@/features/notifications/components/IosNotificationBanner';

vi.mock('@/features/notifications/hooks/useIosNotificationPermission', () => ({
  useIosNotificationPermission: () => ({
    shouldShowPrompt: true,
    isIos: true,
    isSafariWithoutNotification: false,
    isRequesting: false,
    requestPermission: vi.fn(),
    dismissPrompt: vi.fn(),
  }),
}));

describe('Phase 2 Modals, Dialogs & Banners', () => {
  it('VerifyEmailModalView uses semantic surface tokens', () => {
    render(
      <VerifyEmailModalView
        isOpen
        onClose={vi.fn()}
        email="user@byblos.test"
        role="buyer"
        isResending={false}
        resendCooldown={0}
        isSuccess={false}
        onResend={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bg-surface-1');
    expect(dialog.className).toContain('border-separator');
    expect(dialog.className).toContain('text-label');
    expect(dialog.className).not.toContain('bg-white dark:bg-surface-1');
  });

  it('RefundConfirmDialog uses semantic surface tokens and accessible description', () => {
    render(
      <RefundConfirmDialog
        open
        onOpenChange={vi.fn()}
        availableBalance={1500}
        maxWithdrawable={1400}
        withdrawalAmount="500"
        onWithdrawalAmountChange={vi.fn()}
        onSetMaxAmount={vi.fn()}
        mpesaNumber="0712345678"
        onMpesaNumberChange={vi.fn()}
        mpesaName="Jane Doe"
        onMpesaNameChange={vi.fn()}
        withdrawalFee={50}
        totalDeducted={550}
        remainingBalance={950}
        minWithdrawalAmount={100}
        onConfirm={vi.fn()}
        isSubmitting={false}
        formatCurrency={(v) => `KSh ${v}`}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bg-surface-1');
    expect(dialog.className).toContain('border-separator');
    expect(dialog.className).not.toContain('bg-white dark:bg-surface-1');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('OrderDetailsDialog uses semantic surface tokens', () => {
    render(
      <OrderDetailsDialog
        order={{
          id: '1',
          orderNumber: 'ORD-1',
          status: 'paid',
          totalAmount: 1000,
          currency: 'KES',
          createdAt: '2026-11-28T00:00:00Z',
          items: [{ id: 'i1', name: 'Jacket', price: 1000, quantity: 1 }],
        } as never}
        serviceCharge={0}
        onClose={vi.fn()}
        onViewImage={vi.fn()}
        onConfirmReceiptClick={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bg-surface-1');
    expect(dialog.className).toContain('border-separator');
    expect(dialog.className).not.toContain('bg-white dark:bg-surface-1');
  });

  it('IosNotificationBanner dismiss button has mobile-friendly 32px+ touch target', () => {
    render(<IosNotificationBanner />);
    const dismissBtn = screen.getByRole('button', { name: /dismiss banner/i });
    expect(dismissBtn.className).toContain('h-8');
    expect(dismissBtn.className).toContain('w-8');
  });
});

