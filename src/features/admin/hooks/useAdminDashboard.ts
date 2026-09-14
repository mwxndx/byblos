import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalAuth } from '@/features/auth/contexts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useGetBuyerByIdMutation, useDeleteUserMutation, useDeleteCreatorMutation, useGetSellerByIdMutation, useUpdateSellerStatusMutation, useUpdateWithdrawalRequestStatusMutation } from '@/features/admin/hooks/mutations/useAdminMutations';
import {
  useAdminAnalyticsQuery,
  useAdminSellersQuery,
  useAdminCreatorsQuery,
  useAdminBuyersQuery,
  useAdminWithdrawalsQuery,
  useAdminMonthlyMetricsQuery,
  useAdminFinancialsQuery,
  useAdminMonthlyFinancialDataQuery,
  useAdminDashboardStatsQuery,
  useAdminClientsQuery,
  useAdminBalancesQuery
} from '@/features/admin/hooks/queries/useAdminQueries';

import type { DashboardAnalytics, MonthlyMetricsData, WithdrawalRequest, FinancialMetrics, MonthlyFinancialData, DashboardState } from '../types/dashboard';

export function useAdminDashboard() {
  // All hooks must be called unconditionally at the top level
  const { isAuthenticated, isLoading: authLoading } = useGlobalAuth();
  const navigate = useNavigate();

  const getBuyerByIdMutation = useGetBuyerByIdMutation();
  const deleteUserMutation = useDeleteUserMutation();
  const deleteCreatorMutation = useDeleteCreatorMutation();
  const getSellerByIdMutation = useGetSellerByIdMutation();
  const updateSellerStatusMutation = useUpdateSellerStatusMutation();
  const updateWithdrawalRequestStatusMutation = useUpdateWithdrawalRequestStatusMutation();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inspectionSessionId = useMemo(() => {
    const bytes = new Uint32Array(2);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes).map(value => value.toString(36)).join('').toUpperCase() || String(Date.now());
  }, []);

  // Initialize state for dashboard data with proper typing
  // State for ticket buyers modal
  const [error, setError] = useState<string | null>(null);

  // State for seller details modal
  const [selectedSeller, setSelectedSeller] = useState<unknown | null>(null);
  const [isLoadingSeller, setIsLoadingSeller] = useState(false);

  // State for buyer details modal
  const [selectedBuyer, setSelectedBuyer] = useState<unknown | null>(null);
  const [isLoadingBuyer, setIsLoadingBuyer] = useState(false);

  // Id of the withdrawal request currently being approved/rejected, if any --
  // drives the per-row loading/disabled state in AdminWithdrawalsTab so a
  // double-click (or a slow network) can't fire two overrides for the same
  // request. Also checked synchronously at the top of
  // handleWithdrawalRequestAction itself (not just via the disabled prop),
  // since a React state update is not guaranteed to have re-rendered before a
  // second click lands.
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);
  // Row currently being deleted (a user_id for seller/buyer, or a creator id).
  // Only one delete runs at a time, so a single value drives every Delete
  // button's disabled state. Mirrors processingWithdrawalId.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [dashboardState, setDashboardState] = React.useState<DashboardState>({
    analytics: {
      totalRevenue: 0,
      totalProducts: 0,
      totalSellers: 0,
      totalBuyers: 0,
      monthlyGrowth: {
        revenue: 0,
        products: 0,
        sellers: 0,
        buyers: 0
      }
    },
    sellers: [],
    creators: [],
    buyers: [],
    withdrawalRequests: [],
    monthlyMetrics: [],
    financialMetrics: {
      totalSales: 0,
      totalOrders: 0,
      totalCommission: 0,
      totalRefunds: 0,
      totalRefundRequests: 0,
      pendingRefunds: 0,
      netRevenue: 0
    },
    monthlyFinancialData: [],
    clients: [],
    topShops: [],
    providerHealth: null
  });

  const isEnabled = isAuthenticated && !authLoading;
  const analyticsQuery = useAdminAnalyticsQuery(isEnabled);
  const sellersQuery = useAdminSellersQuery(isEnabled);
  const creatorsQuery = useAdminCreatorsQuery(isEnabled);
  const buyersQuery = useAdminBuyersQuery(isEnabled);
  const withdrawalsQuery = useAdminWithdrawalsQuery(isEnabled);
  const monthlyMetricsQuery = useAdminMonthlyMetricsQuery(isEnabled);
  const financialsQuery = useAdminFinancialsQuery(isEnabled);
  const monthlyFinancialDataQuery = useAdminMonthlyFinancialDataQuery(isEnabled);
  const dashboardStatsQuery = useAdminDashboardStatsQuery(isEnabled);
  const clientsQuery = useAdminClientsQuery(isEnabled);
  const balancesQuery = useAdminBalancesQuery(isEnabled);

  const queryClient = useQueryClient();

  // Tracks the last set of failed sections we already toasted about, so the
  // warning fires once per distinct failure (not on every unrelated
  // re-render while a query stays isError) and fires again if a *different*
  // combination of sections starts failing.
  const lastReportedFailureRef = useRef<string>('');

  const refetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.allSettled([
      analyticsQuery.refetch(),
      sellersQuery.refetch(),
      creatorsQuery.refetch(),
      buyersQuery.refetch(),
      withdrawalsQuery.refetch(),
      monthlyMetricsQuery.refetch(),
      financialsQuery.refetch(),
      monthlyFinancialDataQuery.refetch(),
      dashboardStatsQuery.refetch(),
      clientsQuery.refetch(),
      balancesQuery.refetch()
    ]);
    setIsLoading(false);
  }, [
    analyticsQuery,
    sellersQuery,
    creatorsQuery,
    buyersQuery,
    withdrawalsQuery,
    monthlyMetricsQuery,
    financialsQuery,
    monthlyFinancialDataQuery,
    dashboardStatsQuery,
    clientsQuery,
    balancesQuery
  ]);

  useEffect(() => {
    if (!isEnabled) return;

    // Guard against the "flash of false loaded zero-data" bug: this effect
    // used to build dashboardState (and set isInitialized(true)) from
    // whatever `.data` happened to be available on the very first render,
    // which is `undefined` for every query before their first fetch
    // resolves -- briefly rendering a fully "loaded" dashboard with 0
    // sellers/revenue/etc. before the real numbers arrive.
    // `.isLoading` is true only during a query's very first fetch with no
    // cached data, so once every core query has left that state (whether it
    // succeeded, is now isError, or was served from cache), it's safe to
    // finalize. Skip finalizing while any of them are still on that first
    // fetch -- isInitialized stays false, so the page keeps showing its own
    // loading state instead of a premature "empty" one.
    const stillOnFirstFetch = analyticsQuery.isLoading
      || sellersQuery.isLoading
      || creatorsQuery.isLoading
      || buyersQuery.isLoading
      || withdrawalsQuery.isLoading
      || monthlyMetricsQuery.isLoading
      || financialsQuery.isLoading
      || monthlyFinancialDataQuery.isLoading
      || dashboardStatsQuery.isLoading
      || clientsQuery.isLoading
      || balancesQuery.isLoading;
    if (stillOnFirstFetch) return;

    const fetchDashboardData = () => {
      setIsLoading(true);
      setError(null);
      try {
        const analytics = analyticsQuery.data || null;
        const sellers = sellersQuery.data || [];
        const creators = creatorsQuery.data || [];
        const buyers = buyersQuery.data || [];
        const withdrawalRequests = withdrawalsQuery.data || [];
        const monthlyMetrics = monthlyMetricsQuery.data || null;
        const financialMetrics = financialsQuery.data || null;
        const monthlyFinancialData = monthlyFinancialDataQuery.data || [];
        const dashboardStats = dashboardStatsQuery.data || null;
        const clients = clientsQuery.data || [];
        const providerHealth = balancesQuery.data || null;

        const totalSellersCount = Array.isArray(sellers) ? sellers.length : 0;
        const totalCreatorsCount = Array.isArray(creators) ? creators.length : 0;
        const totalBuyersCount = Array.isArray(buyers) ? buyers.length : 0;

        const safeAnalytics: DashboardAnalytics = {
          totalRevenue: financialMetrics?.totalSales || 0,
          totalProducts: dashboardStats?.totalProducts || 0,
          totalSellers: dashboardStats?.totalSellers || totalSellersCount,
          totalCreators: dashboardStats?.totalCreators || totalCreatorsCount,
          totalBuyers: dashboardStats?.totalBuyers || totalBuyersCount,
          totalClients: dashboardStats?.totalClients || 0,
          totalWishlists: dashboardStats?.totalWishlists || 0,
          activeOrders: dashboardStats?.activeOrders || 0,
          lowStockProducts: dashboardStats?.lowStockProducts || 0,
          pendingWithdrawals: dashboardStats?.pendingWithdrawals || 0,
          pendingCreatorRequests: dashboardStats?.pendingCreatorRequests || 0,
          totalCreatorEarnings: dashboardStats?.totalCreatorEarnings || 0,
          userGrowth: analytics?.userGrowth || [],
          revenueTrends: analytics?.revenueTrends || [],
          salesTrends: analytics?.salesTrends || [],
          productStatus: analytics?.productStatus || [],
          geoDistribution: analytics?.geoDistribution || [],
          monthlyGrowth: {
            revenue: analytics?.monthlyGrowth?.revenue || 0,
            products: analytics?.monthlyGrowth?.products || 0,
            sellers: analytics?.monthlyGrowth?.sellers || 0,
            buyers: analytics?.monthlyGrowth?.buyers || 0
          }
        };

        // The backend's monthly-metrics envelope has been observed in three
        // shapes (a bare array, {data: array}, and {data: {data: array}}),
        // so this still tolerates all three -- but narrows through named
        // intermediates instead of re-casting the same `monthlyMetrics`
        // value to a different shape at each branch, which read as a blind
        // assertion even though each branch IS runtime-checked via
        // Array.isArray before its cast.
        const metricsData: MonthlyMetricsData[] = (() => {
          if (Array.isArray(monthlyMetrics)) return monthlyMetrics as MonthlyMetricsData[];
          if (!monthlyMetrics || typeof monthlyMetrics !== 'object') return [];

          const wrapper = monthlyMetrics as { data?: unknown };
          if (Array.isArray(wrapper.data)) return wrapper.data as MonthlyMetricsData[];
          if (!wrapper.data || typeof wrapper.data !== 'object') return [];

          const nested = (wrapper.data as { data?: unknown }).data;
          return Array.isArray(nested) ? (nested as MonthlyMetricsData[]) : [];
        })();

        setDashboardState({
          analytics: safeAnalytics,
          sellers: Array.isArray(sellers) ? sellers : [],
          creators: Array.isArray(creators) ? creators : [],
          buyers: Array.isArray(buyers) ? (buyers as DashboardState['buyers']) : [],
          withdrawalRequests: Array.isArray(withdrawalRequests) ? (withdrawalRequests as WithdrawalRequest[]) : [],
          monthlyMetrics: metricsData,
          financialMetrics: financialMetrics || {
            totalSales: 0,
            totalOrders: 0,
            totalCommission: 0,
            totalRefunds: 0,
            totalRefundRequests: 0,
            pendingRefunds: 0,
            netRevenue: 0
          },
          monthlyFinancialData: Array.isArray(monthlyFinancialData) ? monthlyFinancialData : [],
          clients: Array.isArray(clients) ? clients : [],
          topShops: dashboardStats?.topShops || [],
          providerHealth
        });

        // Surface read failures instead of letting them render as
        // confidently-empty data. Each queryFn now rejects on failure (see
        // src/features/admin/api/*), so TanStack Query's own isError is
        // meaningful here. balancesQuery is intentionally excluded: it backs
        // a health-check widget that already degrades gracefully to an
        // "Unavailable" state (see getPaymentProviderBalances) rather than
        // failing outright, so its own request failures shouldn't warn about
        // the whole dashboard being broken.
        const failedSections: string[] = [];
        if (analyticsQuery.isError) failedSections.push('analytics');
        if (sellersQuery.isError) failedSections.push('sellers');
        if (creatorsQuery.isError) failedSections.push('creators');
        if (buyersQuery.isError) failedSections.push('buyers');
        if (withdrawalsQuery.isError) failedSections.push('withdrawal requests');
        if (monthlyMetricsQuery.isError) failedSections.push('monthly metrics');
        if (financialsQuery.isError) failedSections.push('financial metrics');
        if (monthlyFinancialDataQuery.isError) failedSections.push('monthly financial data');
        if (dashboardStatsQuery.isError) failedSections.push('dashboard stats');
        if (clientsQuery.isError) failedSections.push('clients');

        const failureSignature = failedSections.join(',');
        if (failureSignature && failureSignature !== lastReportedFailureRef.current) {
          toast.error(`Some dashboard data failed to load: ${failedSections.join(', ')}.`, {
            description: "Showing what's available -- try refreshing to retry the failed sections."
          });
        }
        lastReportedFailureRef.current = failureSignature;

      } catch (err: unknown) {
        const error = err as Error;
        setError(error.message || 'Failed to initialize dashboard');
        toast.error('Failed to load dashboard data');
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [
    isEnabled,
    analyticsQuery.data,
    analyticsQuery.isError,
    analyticsQuery.isLoading,
    sellersQuery.data,
    sellersQuery.isError,
    sellersQuery.isLoading,
    creatorsQuery.data,
    creatorsQuery.isError,
    creatorsQuery.isLoading,
    buyersQuery.data,
    buyersQuery.isError,
    buyersQuery.isLoading,
    withdrawalsQuery.data,
    withdrawalsQuery.isError,
    withdrawalsQuery.isLoading,
    monthlyMetricsQuery.data,
    monthlyMetricsQuery.isError,
    monthlyMetricsQuery.isLoading,
    financialsQuery.data,
    financialsQuery.isError,
    financialsQuery.isLoading,
    monthlyFinancialDataQuery.data,
    monthlyFinancialDataQuery.isError,
    monthlyFinancialDataQuery.isLoading,
    dashboardStatsQuery.data,
    dashboardStatsQuery.isError,
    dashboardStatsQuery.isLoading,
    clientsQuery.data,
    clientsQuery.isError,
    clientsQuery.isLoading,
    balancesQuery.data,
    balancesQuery.isLoading
  ]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const safeFormatDate = (dateString: string | null | undefined, formatStr: string = 'MMM d, yyyy') => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatStr);
    } catch (error) {
      return 'N/A';
    }
  };

  const formatProviderBalance = (account: unknown) => {
    if (!account) return 'Unavailable';
    const acc = account as Record<string, unknown>;
    if (acc.error) return 'Check needed';
    const balance = acc.available_balance ?? acc.availableBalance ?? acc.balance;
    if (balance === undefined || balance === null || Number.isNaN(Number(balance))) return 'Connected';
    const currency = acc.currency || 'KES';
    return `${currency} ${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const providerHealth = dashboardState.providerHealth as {
    payin?: Record<string, unknown>;
    payout?: Record<string, unknown>;
  } | null;
  const providerHealthAvailable = Boolean(providerHealth);
  const providerHealthOk = providerHealthAvailable
    && !providerHealth?.payin?.error
    && !providerHealth?.payout?.error;

  const pendingPayoutRequests = useMemo(() => (
    dashboardState.withdrawalRequests.filter(request =>
      !['completed', 'failed', 'rejected'].includes(String(request.status).toLowerCase())
    )
  ), [dashboardState.withdrawalRequests]);

  const pendingPayoutAmount = useMemo(() => (
    pendingPayoutRequests.reduce((sum, request) => sum + (Number(request.amount) || 0), 0)
  ), [pendingPayoutRequests]);

  // Guards against a stale response overwriting a newer one: if the admin
  // clicks View on seller A, then clicks View on seller B before A's
  // request resolves, and A's response happens to land after B's, this
  // would previously overwrite selectedSeller with A's data while the
  // admin -- looking at a modal they believe is showing B -- has no idea
  // the identity/balance/orders on screen actually belong to a different
  // seller. Tracks which id is the latest request and ignores anything
  // that resolves for a different one.
  const latestSellerRequestIdRef = useRef<string | null>(null);

  const handleViewSeller = async (sellerId: string) => {
    latestSellerRequestIdRef.current = sellerId;
    try {
      setIsLoadingSeller(true);
      const response = await getSellerByIdMutation.mutateAsync(sellerId);
      if (latestSellerRequestIdRef.current !== sellerId) return;
      setSelectedSeller(response);
    } catch (error) {
      if (latestSellerRequestIdRef.current !== sellerId) return;
      toast.error('Failed to load seller details');
    } finally {
      if (latestSellerRequestIdRef.current === sellerId) {
        setIsLoadingSeller(false);
      }
    }
  };

  const closeSellerModal = () => {
    setSelectedSeller(null);
  };

  const handleToggleSellerStatus = async (sellerId: string, newStatus: 'active' | 'inactive') => {
    try {
      // A blind `as { data: { status: string } }` cast used to gate this
      // update on response.data.status === 'success' with no runtime check.
      // Axios already rejects (into the catch below) on any non-2xx response,
      // so reaching past the await means the request succeeded -- there is
      // nothing left to validate, and the old cast/check could only ever
      // silently no-op (no toast, no state update, no error) if the backend's
      // success body ever stopped matching the assumed shape. Mirrors
      // handleDeleteUser/handleDeleteCreator's unconditional-after-await
      // pattern below.
      await updateSellerStatusMutation.mutateAsync({ sellerId, status: newStatus });

      setDashboardState(prevState => ({
        ...prevState,
        sellers: prevState.sellers.map(seller =>
          seller.id === sellerId
            ? { ...seller, status: newStatus }
            : seller
        )
      }));

      toast.success(`Seller has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      // useUpdateSellerStatusMutation's own onError already shows the real
      // backend reason via classifyApiError — this catch only exists to stop
      // execution before the success-branch state update above runs.
    }
  };

  // Handle viewing buyer details
  // Same stale-response guard as handleViewSeller above.
  const latestBuyerRequestIdRef = useRef<string | null>(null);

  const handleViewBuyer = async (buyerId: string) => {
    latestBuyerRequestIdRef.current = buyerId;
    try {
      setIsLoadingBuyer(true);
      const response = await getBuyerByIdMutation.mutateAsync(buyerId);
      if (latestBuyerRequestIdRef.current !== buyerId) return;
      setSelectedBuyer(response);
    } catch (error) {
      if (latestBuyerRequestIdRef.current !== buyerId) return;
      toast.error('Failed to load buyer details');
    } finally {
      if (latestBuyerRequestIdRef.current === buyerId) {
        setIsLoadingBuyer(false);
      }
    }
  };

  // Close buyer details modal
  const closeBuyerModal = () => {
    setSelectedBuyer(null);
  };

  // Handle deleting/blocking user
  const handleDeleteUser = async (userId: string | undefined, role: 'seller' | 'buyer') => {
    if (!userId) {
      toast.error(`This ${role} is already detached from a login user`);
      return;
    }

    // Synchronous re-entrancy guard (checked before the confirm/await), same as
    // handleWithdrawalRequestAction: a second click can't start a duplicate DELETE.
    if (deletingId) return;

    if (!window.confirm(`Delete this ${role}'s login account? Financial history and order records will be preserved for audit.`)) {
      return;
    }

    setDeletingId(String(userId));
    try {
      await deleteUserMutation.mutateAsync(userId);
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} user deleted. History was preserved.`);

      // Refresh data
      setDashboardState(prev => ({
        ...prev,
        sellers: role === 'seller' ? prev.sellers.filter(s => String(s.user_id) !== String(userId)) : prev.sellers,
        buyers: role === 'buyer' ? prev.buyers.filter(b => String(b.user_id) !== String(userId)) : prev.buyers
      }));
    } catch (error) {
      // useDeleteUserMutation's own onError already shows the real backend
      // reason via classifyApiError.
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCreator = async (creatorId: string, creatorName?: string) => {
    if (deletingId) return;

    if (!window.confirm(`Delete ${creatorName || 'this creator'}'s account? Their earnings and sales history will be preserved for audit.`)) {
      return;
    }

    setDeletingId(String(creatorId));
    try {
      await deleteCreatorMutation.mutateAsync(creatorId);
      toast.success('Creator account deleted. History was preserved.');
      setDashboardState(prev => ({
        ...prev,
        creators: prev.creators.filter(creator => String(creator.id) !== String(creatorId))
      }));
    } catch (error) {
      // useDeleteCreatorMutation's own onError already shows the real backend
      // reason via classifyApiError.
    } finally {
      setDeletingId(null);
    }
  };

  const handleWithdrawalRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    // Synchronous re-entrancy guard: checked (and set) before any await, so a
    // second click landing before the state update above has re-rendered
    // still can't slip through -- the disabled prop alone can't guarantee
    // that, since setState/re-render isn't synchronous.
    if (processingWithdrawalId) return;
    setProcessingWithdrawalId(requestId);

    // The backend (admin.service.js overrideWithdrawalStatus) only accepts
    // 'completed'/'failed' -- the real terminal states withdrawal_requests.status
    // reaches. 'approved'/'rejected' is this component's own UI vocabulary.
    const status = action === 'approved' ? 'completed' : 'failed';
    // Deterministic per (request, target status): a genuine retry of the same
    // action reuses the same key. Matches the refund-moderation flow's
    // `refund-confirm-${id}` / `refund-reject-${id}` pattern.
    const idempotencyKey = `withdrawal-${status}-${requestId}`;

    try {
      // Same fix as handleToggleSellerStatus: no more blind
      // `as { data: { status: string } }` cast gating the update on an
      // unvalidated field. Axios rejects into the catch below on any non-2xx
      // response, so reaching past the await already means success.
      await updateWithdrawalRequestStatusMutation.mutateAsync({ requestId, status, idempotencyKey });

      // Update the UI to reflect the new status
      setDashboardState(prevState => ({
        ...prevState,
        withdrawalRequests: prevState.withdrawalRequests.map(request =>
          request.id === requestId
            ? {
              ...request,
              status,
              processedAt: new Date().toISOString(),
              processedBy: 'Admin' // You might want to get the actual admin name
            }
            : request
        )
      }));

      toast.success(`Withdrawal request has been ${action}`);
    } catch (error) {
      // useUpdateWithdrawalRequestStatusMutation's own onError already shows
      // the real backend reason via classifyApiError.
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  // Loading and error states are now handled at the top of the component

  // Accessibility labels and aria roles were missing on modals

  // Retry handler for the dashboard error screen: clears the error, resets the
  // initialized flag (which surfaces the loading state), and bumps the reload
  // token to force a fresh render pass. Mirrors the pre-decomposition behavior.
  const retryDashboard = useCallback(() => {
    // Previously only reset local flags (error, isInitialized) and bumped an
    // unused reload token -- no network request was ever fired, so every
    // query stayed in its already-failed state, the aggregating effect
    // still had nothing new to read, and isInitialized never got set back
    // to true. The error screen's "Try Again" button did nothing until a
    // full page reload. refetchAll() actually re-requests every query;
    // isInitialized(false) shows the loading state while that's in flight,
    // and the aggregating effect (gated on each query's isLoading/isError)
    // finalizes again once the refetches settle.
    setError(null);
    setIsInitialized(false);
    void refetchAll();
  }, [refetchAll]);

  return {
    authLoading,
    isAuthenticated,
    isInitialized,
    error,
    retryDashboard,
    dashboardState,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    safeFormatDate,
    formatProviderBalance,
    providerHealth,
    providerHealthOk,
    providerHealthAvailable,
    pendingPayoutRequests,
    pendingPayoutAmount,
    inspectionSessionId,
    selectedSeller,
    isLoadingSeller,
    closeSellerModal,
    selectedBuyer,
    isLoadingBuyer,
    closeBuyerModal,
    handleViewSeller,
    handleDeleteUser,
    handleDeleteCreator,
    deletingId,
    handleViewBuyer,
    handleWithdrawalRequestAction,
    processingWithdrawalId,
  };
}
