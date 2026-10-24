import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewAdminDashboard from '../NewDashboardPage';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/auth/hooks/useGlobalAuth', () => ({
  useGlobalAuth: () => ({
    logout: mockLogout,
    user: { email: 'admin@byblos.test' },
  }),
}));

vi.mock('../../hooks/useAdminDashboard', () => ({
  useAdminDashboard: () => ({
    authLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    isInitialized: true,
    error: null,
    retryDashboard: vi.fn(),
    dashboardState: {
      analytics: {
        salesTrends: [],
        revenueTrends: [],
        userGrowth: [],
        geoDistribution: [],
        productStatus: [],
        categoryDistribution: [],
      },
      topShops: [],
      sellers: [],
      creators: [],
      buyers: [],
      withdrawalRequests: [],
      financialMetrics: {
        totalSales: 0,
        totalCommission: 0,
        totalRefunds: 0,
      },
    },
    activeTab: 'overview',
    setActiveTab: vi.fn(),
    sellersList: { search: '', setSearch: vi.fn(), setPage: vi.fn() },
    creatorsList: { search: '', setSearch: vi.fn(), setPage: vi.fn() },
    buyersList: { search: '', setSearch: vi.fn(), setPage: vi.fn() },
    withdrawalsList: { search: '', setSearch: vi.fn(), setPage: vi.fn() },
    paginationState: {
      sellers: { total: 0, page: 1, limit: 10 },
      creators: { total: 0, page: 1, limit: 10 },
      buyers: { total: 0, page: 1, limit: 10 },
      withdrawalRequests: { total: 0, page: 1, limit: 10 },
    },
    safeFormatDate: (d: string) => d || '',
    handleDeleteUser: vi.fn(),
    handleDeleteCreator: vi.fn(),
    handleWithdrawalRequestAction: vi.fn(),
    handleViewSeller: vi.fn(),
    handleViewBuyer: vi.fn(),
    closeSellerModal: vi.fn(),
    closeBuyerModal: vi.fn(),
    selectedSeller: null,
    selectedBuyer: null,
    isLoadingSeller: false,
    isLoadingBuyer: false,
    deletingId: null,
    processingWithdrawalId: null,
    pendingPayoutCount: 0,
    pendingPayoutAmount: 0,
    pendingRefundCount: 0,
    pendingDetectionCount: 0,
    openOrderCount: 0,
    logisticsProblems: 0,
    providerHealth: null,
    providerHealthOk: true,
    providerHealthAvailable: true,
    formatProviderBalance: vi.fn(),
    inspectionSessionId: null,
  }),
}));

vi.mock('../../api', () => ({
  adminApi: {
    getLogisticsRequests: vi.fn().mockResolvedValue([]),
  },
}));

// Recharts mock
vi.mock('recharts', async () => {
  const original = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

describe('NewAdminDashboard Header & Actions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it('renders Byblos logo, black Admin text, and does NOT render Byblos operations', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Byblos logo (black mark for white header)
    const logo = screen.getByAltText('Byblos');
    expect(logo).toBeDefined();
    expect(logo.getAttribute('src')).toContain('byblos-mark-light');

    // 2. Admin text in header
    const adminHeading = screen.getByRole('heading', { name: 'Admin', level: 1 });
    expect(adminHeading).toBeDefined();
    expect(adminHeading.className).toContain('text-black');

    // 3. "Byblos operations" text is removed
    expect(screen.queryByText('Byblos operations')).toBeNull();
  });

  it('renders Notification bell with black color in the admin header', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = screen.getByRole('button', { name: /notifications/i });
    expect(bellBtn).toBeDefined();
    expect(bellBtn.className).toContain('!text-black');
    const bellSvg = bellBtn.querySelector('svg');
    expect(bellSvg).toBeDefined();
    expect(bellSvg?.getAttribute('style')).toContain('rgb(0, 0, 0)');
  });

  it('renders admin tab selectors with white active state styling', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    expect(overviewTab).toBeDefined();
    expect(overviewTab.className).toContain('data-[state=active]:!bg-white');
    expect(overviewTab.className).toContain('data-[state=active]:!text-black');
  });

  it('renders Sign out button and invokes logout upon click', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.className).toContain('bg-white');

    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/admin/login', { replace: true });
    });
  });

  it('renders Broadcast Update button with white button styling', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const broadcastBtns = screen.getAllByRole('button', { name: /broadcast update/i });
    expect(broadcastBtns.length).toBeGreaterThan(0);
    for (const btn of broadcastBtns) {
      expect(btn.className).toContain('bg-white');
    }
  });
});
