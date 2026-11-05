import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestCard } from '../MzigoRequestCard';
import type { LogisticsRequestCard } from '@/features/logistics/api';

describe('MzigoRequestCard', () => {
  const mockRequest: LogisticsRequestCard = {
    id: 101,
    packageCode: 'BYB-101',
    group: 'pickup_delivery',
    status: 'in_progress',
    deadlineAt: null,
    completedAt: null,
    isOverdue: false,
    order: {
      id: 50,
      orderNumber: 'ORD-101',
      totalAmount: 2500,
      paymentStatus: 'completed',
    },
    product: {
      items: [
        {
          id: 1,
          name: 'Vintage Denim Jacket',
          price: 2500,
          quantity: 1,
          subtotal: 2500,
        },
      ],
      summary: 'Vintage Denim Jacket x1',
    },
    seller: {
      id: 2,
      name: 'Jane Seller',
      shopName: 'Vintage Hub',
      phone: '+254711000000',
      location: 'Westlands',
    },
    buyer: {
      name: 'John Buyer',
      phone: '+254722000000',
    },
    pickupFeeStatus: 'paid',
    deliveryFeeStatus: 'paid',
    sellerDropoff: {
      label: 'Hub',
    },
    events: [
      {
        id: 1,
        type: 'delivery.picked_up',
        status: 'picked_up',
        message: 'Rider collected package from seller',
        source: 'mzigo',
        actorLabel: 'Rider Alex',
        createdAt: '2026-11-05T10:00:00Z',
      },
      {
        id: 2,
        type: 'delivery.assigned',
        status: 'assigned',
        message: 'Delivery assigned to courier',
        source: 'system',
        createdAt: '2026-11-05T09:30:00Z',
      },
    ],
  };

  it('renders package summary and product info', () => {
    render(
      <RequestCard
        request={mockRequest}
        tone="border-white/10"
        now={Date.now()}
        onStatusUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Vintage Denim Jacket x1')).toBeDefined();
    expect(screen.getByText(/ORD-101/)).toBeDefined();
  });

  it('reveals tracking history timeline when expanded', () => {
    render(
      <RequestCard
        request={mockRequest}
        tone="border-white/10"
        now={Date.now()}
        onStatusUpdate={vi.fn()}
      />
    );

    // Click 'More' button to expand
    const moreBtn = screen.getByRole('button', { name: /More/i });
    fireEvent.click(moreBtn);

    // Tracking history section and events should now be visible
    expect(screen.getByText(/Tracking history/i)).toBeDefined();
    expect(screen.getByText('Rider collected package from seller')).toBeDefined();
    expect(screen.getByText('Delivery assigned to courier')).toBeDefined();
  });
});

