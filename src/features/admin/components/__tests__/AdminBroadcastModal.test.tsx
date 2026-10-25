import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminBroadcastModal } from '../AdminBroadcastModal';
import { adminApi } from '@/features/admin/api';

vi.mock('@/features/admin/api', () => ({
  adminApi: {
    broadcastAppUpdate: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminBroadcastModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open with default values', () => {
    render(<AdminBroadcastModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /Broadcast App Update/i })).toBeDefined();
    expect(screen.getByDisplayValue('72')).toBeDefined();
    expect(screen.getByDisplayValue('Update Available: Byblos 1.0.72')).toBeDefined();
    expect(screen.getByRole('button', { name: /Broadcast Update/i })).toBeDefined();
  });

  it('dispatches broadcast update and shows results grid', async () => {
    vi.mocked(adminApi.broadcastAppUpdate).mockResolvedValueOnce({
      success: true,
      minVersionCode: 72,
      targetedDevices: 12,
      fcmSent: 10,
      fcmFailed: 2,
      inAppNotificationsCreated: 12,
    });

    render(<AdminBroadcastModal isOpen={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Broadcast Update/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminApi.broadcastAppUpdate).toHaveBeenCalledWith({
        minVersionCode: 72,
        title: 'Update Available: Byblos 1.0.72',
        body: 'A new version of Byblos is available. Please update now to continue using all features.',
        storeUrl: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Broadcast Dispatched/i)).toBeDefined();
      expect(screen.getByText('Target Devices')).toBeDefined();
      expect(screen.getAllByText('12')).toHaveLength(2);
      expect(screen.getByText('10')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });
  });
});
