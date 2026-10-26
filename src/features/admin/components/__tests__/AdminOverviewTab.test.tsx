import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminOverviewTab } from '../AdminOverviewTab';
import { GeoDistributionChart } from '../AdminDashboardCharts';

// Mock Recharts
vi.mock('recharts', async () => {
  const original = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

describe('AdminOverviewTab', () => {
  const mockDashboardState = {
    analytics: {
      salesTrends: [
        { name: 'May', sales: 12000 },
        { name: 'Jun', sales: 25000 },
      ],
      revenueTrends: [
        { name: 'May', revenue: 1200, orders: 15 },
        { name: 'Jun', revenue: 2500, orders: 30 },
      ],
      userGrowth: [
        { name: 'May', buyers: 20, sellers: 5, creators: 2 },
        { name: 'Jun', buyers: 40, sellers: 10, creators: 5 },
      ],
      geoDistribution: [
        { name: 'CBD', buyers: 50, sellers: 12, creators: 4, gmv: 85000, value: 66 },
        { name: 'Westlands', buyers: 25, sellers: 6, creators: 2, gmv: 35000, value: 33 },
      ],
      productStatus: [
        { name: 'Physical', value: 80, inventory: 400 },
        { name: 'Digital', value: 20, inventory: 100 },
      ],
      categoryDistribution: [
        { name: 'Clothes & Style', value: 45 },
        { name: 'Tech & Gadgets', value: 25 },
        { name: 'Home & Living', value: 15 },
      ],
    },
    topShops: [
      { id: 1, name: 'Shop One', shopName: 'Shop One Official', totalSales: 500000 },
      { id: 2, name: 'Shop Two', shopName: 'Shop Two Official', totalSales: 400000 },
      { id: 3, name: 'Shop Three', shopName: 'Shop Three Official', totalSales: 300000 },
      { id: 4, name: 'Shop Four', shopName: 'Shop Four Official', totalSales: 200000 },
      { id: 5, name: 'Shop Five', shopName: 'Shop Five Official', totalSales: 100000 },
      { id: 6, name: 'Shop Six', shopName: 'Shop Six Official', totalSales: 50000 },
      { id: 7, name: 'Shop Seven', shopName: 'Shop Seven Official', totalSales: 10000 },
    ],
  };

  it('renders Product Distribution and Category Distribution side by side', () => {
    render(
      <AdminOverviewTab
        dashboardState={mockDashboardState}
        safeFormatDate={(d) => d || ''}
        onShowSellers={() => {}}
      />
    );

    expect(screen.getByText('Product Distribution')).toBeDefined();
    expect(screen.getByText('Category Distribution')).toBeDefined();
  });

  it('renders Top Shops with up to 6 shops and does not render recent sellers', () => {
    render(
      <AdminOverviewTab
        dashboardState={mockDashboardState}
        safeFormatDate={(d) => d || ''}
        onShowSellers={() => {}}
      />
    );

    // Should render Top Shops
    expect(screen.getByText('Top Shops')).toBeDefined();
    expect(screen.getByText('Shop One Official')).toBeDefined();
    expect(screen.getByText('Shop Six Official')).toBeDefined();
    // Shop Seven should be sliced out (limit 6)
    expect(screen.queryByText('Shop Seven Official')).toBeNull();

    // Recent sellers must NOT be rendered
    expect(screen.queryByText('Recent sellers')).toBeNull();
  });

  it('renders all charts in Analytics section', () => {
    render(
      <AdminOverviewTab
        dashboardState={mockDashboardState}
        safeFormatDate={(d) => d || ''}
        onShowSellers={() => {}}
      />
    );

    expect(screen.getByText('Sales Volume')).toBeDefined();
    expect(screen.getByText('Revenue Trends')).toBeDefined();
    expect(screen.getByText('User Growth')).toBeDefined();
    expect(screen.getByText('Geographic Reach')).toBeDefined();
  });

  describe('GeoDistributionChart', () => {
    it('filters out generic "Nairobi" entries and displays genuine Nairobi locations', () => {
      const data = [
        { name: 'Nairobi', buyers: 10, sellers: 2, creators: 1, gmv: 5000 },
        { name: 'CBD', buyers: 4, sellers: 1, creators: 1, gmv: 2500 }
      ];
      render(<GeoDistributionChart data={data} />);
      expect(screen.getByText('Geographic Reach')).toBeDefined();
      expect(screen.getByText('Nairobi locations by GMV, buyers, sellers, and creators')).toBeDefined();
      expect(screen.queryByText('No geographic activity yet')).toBeNull();
    });

    it('shows empty state when data only contains filtered "Nairobi" or empty entries', () => {
      const data = [
        { name: 'Nairobi', buyers: 10, sellers: 2, creators: 1, gmv: 5000 },
        { name: 'unknown city', buyers: 1, sellers: 0, creators: 0, gmv: 0 }
      ];
      render(<GeoDistributionChart data={data} />);
      expect(screen.getByText('No geographic activity yet')).toBeDefined();
    });
  });
});
