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
    getSellerLocations: vi.fn(),
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

describe('MarketingDashboard UI & Data Flow', () => {
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
    vi.mocked(marketingApi.getGeography).mockResolvedValueOnce({ data: { data: { buyers: [], sellers: [] } } } as unknown as ReturnType<typeof marketingApi.getGeography>);
    vi.mocked(marketingApi.getTopPerformers).mockResolvedValueOnce({ data: { data: {} } } as unknown as ReturnType<typeof marketingApi.getTopPerformers>);
    vi.mocked(marketingApi.getReferrals).mockResolvedValueOnce({ data: { data: {} } } as unknown as ReturnType<typeof marketingApi.getReferrals>);

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

  it('renders Byblos logo in the header and displays Top Seller Locations instead of Order Conversion Funnel, with no Recent Activity', async () => {
    vi.mocked(marketingApi.getOverview).mockResolvedValueOnce({
      data: {
        data: {
          totalUsers: 200,
          totalBuyers: 150,
          newBuyersThisMonth: 10,
          activeSellers: 40,
          pendingSellers: 2,
          activeCreators: 10,
          creatorEarningsTotalKsh: 5000,
          totalGmvCents: 5000000,
          userGrowthMoM: 5.2,
          gmvGrowthMoM: 12.0,
          totalOrders: 80,
        },
      },
    } as unknown as ReturnType<typeof marketingApi.getOverview>);

    vi.mocked(marketingApi.getGmvTrend).mockResolvedValueOnce({
      data: {
        data: [
          { month: 'Jan 26', gmvKsh: 25000 },
          { month: 'Feb 26', gmvKsh: 35000 },
        ],
      },
    } as unknown as ReturnType<typeof marketingApi.getGmvTrend>);

    vi.mocked(marketingApi.getUserGrowth).mockResolvedValueOnce({
      data: {
        data: [
          { month: 'Jan 26', buyers: 15, sellers: 5, creators: 3 },
          { month: 'Feb 26', buyers: 25, sellers: 8, creators: 6 },
        ],
      },
    } as unknown as ReturnType<typeof marketingApi.getUserGrowth>);

    vi.mocked(marketingApi.getProductMix).mockResolvedValueOnce({
      data: {
        data: [{ category: 'Electronics', count: 40 }],
      },
    } as unknown as ReturnType<typeof marketingApi.getProductMix>);

    vi.mocked(marketingApi.getGeography).mockResolvedValueOnce({
      data: {
        data: {
          buyers: [{ city: 'Nairobi', count: 120, percentage: 80 }],
          sellers: [{ city: 'Mombasa', count: 30, percentage: 75 }],
        },
      },
    } as unknown as ReturnType<typeof marketingApi.getGeography>);

    vi.mocked(marketingApi.getTopPerformers).mockResolvedValueOnce({ data: { data: {} } } as unknown as ReturnType<typeof marketingApi.getTopPerformers>);
    vi.mocked(marketingApi.getReferrals).mockResolvedValueOnce({ data: { data: {} } } as unknown as ReturnType<typeof marketingApi.getReferrals>);

    render(
      <MemoryRouter>
        <MarketingDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 1. Byblos logo in header
      const logo = screen.getByAltText('Byblos');
      expect(logo).toBeDefined();
      expect(logo.getAttribute('src')).toContain('byblos-mark');

      // 2. Top Seller Locations rendered
      expect(screen.getByText('Top Seller Locations')).toBeDefined();
      expect(screen.getByText('Mombasa')).toBeDefined();

      // 3. Top Buyer Locations rendered
      expect(screen.getByText('Top Buyer Locations')).toBeDefined();
      expect(screen.getByText('Nairobi')).toBeDefined();

      // 4. Order Conversion Funnel is NOT present
      expect(screen.queryByText('Order Conversion Funnel')).toBeNull();

      // 5. Recent Activity / Live Platform Activity is NOT present
      expect(screen.queryByText('Live Platform Activity')).toBeNull();
      expect(screen.queryByText('Recent Platform Activity')).toBeNull();
    });
  });
});
