import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { PaymentStatusModal } from '../PaymentStatusModal';

// Mock mutations
const mockCancelMutateAsync = vi.fn().mockResolvedValue({ success: true });
const mockGetStatusMutateAsync = vi.fn().mockResolvedValue({
  paymentStatus: 'pending',
  status: 'PENDING',
});

vi.mock('@/features/buyer/hooks/queries/useOrderStatusQuery', () => ({
  useGetOrderStatusMutation: () => ({
    mutateAsync: mockGetStatusMutateAsync,
  }),
  useCancelPublicOrderMutation: () => ({
    mutateAsync: mockCancelMutateAsync,
  }),
}));

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({
    loginWithToken: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('PaymentStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a cancel and retry button during POLLING state so user is not trapped', async () => {
    const handleClose = vi.fn();
    const handleCancelRetry = vi.fn();

    render(
      <PaymentStatusModal
        isOpen={true}
        orderNumber="ORD-12345"
        invoiceId="ORD-12345"
        onClose={handleClose}
        onCancelRetry={handleCancelRetry}
        checkoutToken="checkout:token:1"
      />
    );

    expect(screen.getByRole('heading', { name: /^Confirming Payment$/i })).toBeInTheDocument();
    expect(screen.getByText(/ORD-12345/i)).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', {
      name: /didn't get prompt\? cancel & try again/i,
    });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockCancelMutateAsync).toHaveBeenCalledWith({
        orderNumber: 'ORD-12345',
        clientCheckoutToken: 'checkout:token:1',
      });
      expect(handleCancelRetry).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('renders failure reason and retry button when status transition fails', async () => {
    mockGetStatusMutateAsync.mockResolvedValueOnce({
      paymentStatus: 'failed',
      failureReason: 'M-Pesa balance was insufficient',
    });

    const handleClose = vi.fn();
    const handleCancelRetry = vi.fn();

    render(
      <PaymentStatusModal
        isOpen={true}
        orderNumber="ORD-999"
        invoiceId="ORD-999"
        onClose={handleClose}
        onCancelRetry={handleCancelRetry}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Payment Failed$/i })).toBeInTheDocument();
      expect(screen.getByText(/M-Pesa balance was insufficient/i)).toBeInTheDocument();
    });

    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();

    fireEvent.click(tryAgainButton);
    expect(handleCancelRetry).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
