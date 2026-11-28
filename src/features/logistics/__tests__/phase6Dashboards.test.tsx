import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useMzigoDashboard', () => ({
  useMzigoDashboard: () => ({
    now: Date.now(),
    updatingStatusKey: null,
    dashboard: { activeCount: 0, overdueCount: 0 },
    grouped: { completed: [] },
    activeCount: 0,
    overdueCount: 0,
    handleLogout: vi.fn(),
    handleStatusUpdate: vi.fn(),
    requestsQuery: { isLoading: false, isError: false },
  }),
}));

vi.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('@/shared/hooks/useAppTheme', () => ({
  useAppTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('@/features/marketing/api/marketingApi', () => ({
  marketingApi: {
    getOverview: vi.fn().mockResolvedValue({ data: { totalUsers: 100 } }),
    getGmvTrend: vi.fn().mockResolvedValue({ data: [] }),
    getUserGrowth: vi.fn().mockResolvedValue({ data: [] }),
    getProductMix: vi.fn().mockResolvedValue({ data: [] }),
    getGeography: vi.fn().mockResolvedValue({ data: { buyers: [], sellers: [] } }),
    getTopPerformers: vi.fn().mockResolvedValue({ data: {} }),
    getReferrals: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: () => <div />,
  Area: () => <div />,
  BarChart: () => <div />,
  Bar: () => <div />,
  PieChart: () => <div />,
  Pie: () => <div />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

import MzigoDashboardPage from '../pages/MzigoDashboardPage';
import MarketingDashboard from '@/features/marketing/pages/MarketingDashboard';

describe('Phase 6 Dashboards (Mzigo & Marketing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MzigoDashboardPage uses semantic tokens and min-h-[100dvh] on main', () => {
    const { container } = render(
      <MemoryRouter>
        <MzigoDashboardPage />
      </MemoryRouter>
    );

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.className).toContain('min-h-full');
    expect(main?.className).toContain('min-h-[100dvh]');
    expect(main?.className).toContain('text-label');

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    expect(refreshBtn.className).toContain('border-separator');
    expect(refreshBtn.className).toContain('bg-fill');
    expect(refreshBtn.className).toContain('text-label');
    expect(refreshBtn.className).not.toContain('text-slate-800 dark:text-white');
  });

  it('MarketingDashboard uses min-h-[100dvh], pb-safe-bottom, and main landmark', async () => {
    const { container } = render(
      <MemoryRouter>
        <MarketingDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Marketing/i)).toBeInTheDocument();
    });

    const rootDiv = container.firstElementChild as HTMLElement | null;
    expect(rootDiv?.className).toContain('min-h-[100dvh]');
    expect(rootDiv?.className).toContain('pb-safe-bottom');

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
  });
});

