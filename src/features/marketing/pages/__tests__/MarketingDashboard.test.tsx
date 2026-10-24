import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketingDashboard from '../MarketingDashboard';
import { marketingApi } from '../../api/marketingApi';

vi.mock('../../api/marketingApi', () => ({
  marketingApi: {
    getOverview: vi.fn(),
    getGmvTrend: vi.fn(),
    getUserGrowth: vi.fn(),
    getProductMix: vi.fn(),
    getOrderFunnel: vi.fn(),
    getGeography: vi.fn(),
    getTopPerformers: vi.fn(),
    getReferrals: vi.fn(),
    getActivity: vi.fn(),
  },
}));

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({
    user: { profile: { email: 'marketing@byblos.test', name: 'Marketing Admin' } },
    logout: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/useAppTheme', () => ({
  useAppTheme: () => ({ theme: 'dark' }),
}));

// Recharts ResponsiveContainer needs width/height in jsdom
vi.mock('recharts', async () => {
  const original = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

describe('MarketingDashboard Overview Cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Registered Buyers stat card with count and subtitle', async () => {
    vi.mocked(marketingApi.getOverview).mockResolvedValueOnce({
      data: {
        data: {
          totalUsers: 1500,
          totalBuyers: 1420,
          newBuyersThisMonth: 85,
          activeSellers: 50,
          pendingSellers: 5,
          activeCreators: 30,
          creatorEarningsTotalKsh: 50000,
          totalGmvCents: 100000000,
          userGrowthMoM: 12.5,
          gmvGrowthMoM: 8.4,
          totalOrders: 600,
        },
      },
    } as unknown as ReturnType<typeof marketingApi.getOverview>);

    vi.mocked(marketingApi.getGmvTrend).mockResolvedValueOnce({ data: { data: [] } } as unknown as ReturnType<typeof marketingApi.getGmvTrend>);
    vi.mocked(marketingApi.getUserGrowth).mockResolvedValueOnce({ data: { data: [] } } as unknown as ReturnType<typeof marketingApi.getUserGrowth>);
    vi.mocked(marketingApi.getProductMix).mockResolvedValueOnce({ data: { data: [] } } as unknown as ReturnType<typeof marketingApi.getProductMix>);
    vi.mocked(marketingApi.getOrderFunnel).mockResolvedValueOnce({ data: { data: [] } } as unknown as ReturnType<typeof marketingApi.getOrderFunnel>);
    vi.mocked(marketingApi.getGeography).mockResolvedValueOnce({ data: { data: [] } } as unknown as ReturnType<typeof marketingApi.getGeography>);
    vi.mocked(marketingApi.getTopPerformers).mockResolvedValueOnce({ data: { data: {} } } as unknown as ReturnType<typeof marketingApi.getTopPerformers>);
    vi.mocked(marketingApi.getReferrals).mockResolvedValueOnce({ data: { data: {} } } as unknown as ReturnType<typeof marketingApi.getReferrals>);
    vi.mocked(marketingApi.getActivity).mockResolvedValueOnce({ data: { data: [] } } as unknown as ReturnType<typeof marketingApi.getActivity>);

    render(
      <MemoryRouter>
        <MarketingDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Registered Buyers')).toBeDefined();
      expect(screen.getByText('1,420')).toBeDefined();
      expect(screen.getByText('85 joined this month')).toBeDefined();
    });

    expect(screen.getByText('Total Registered Users')).toBeDefined();
    expect(screen.getByText('Active Sellers')).toBeDefined();
    expect(screen.getByText('Active Creators')).toBeDefined();
  });
});
