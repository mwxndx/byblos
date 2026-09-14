import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type OrderStatus } from '@/shared/types';

import { useToast } from '@/shared/hooks/use-toast';
import {
  useSelectHubDropoffMutation,
  useMarkDroppedAtHubMutation,
  useUpdateOrderStatusMutation,
  useConfirmBookingMutation,
  useCancelSellerOrderMutation
} from '@/features/seller/hooks/mutations/useSellerOrderMutations';
import { useAsyncLock } from '@/shared/hooks/useAsyncLock';
import { useSellerOrders } from '../components/dashboard/hooks/useSellerOrders';
import { sellerDashboardQueryKeys } from '../components/dashboard/queryKeys';
import { usePickupRequestFlow } from './usePickupRequestFlow';

export function useSellerOrderActions() {
    const queryClient = useQueryClient();
    const ordersQuery = useSellerOrders();
    const orders = useMemo(() => ordersQuery.data || [], [ordersQuery.data]);
    const isLoading = ordersQuery.isLoading;
    const [isUpdating, setIsUpdating] = useState(false);

    const selectHubDropoffMutation = useSelectHubDropoffMutation();
    const markDroppedAtHubMutation = useMarkDroppedAtHubMutation();
    const updateOrderStatusMutation = useUpdateOrderStatusMutation();
    const confirmBookingMutation = useConfirmBookingMutation();
    const cancelOrderMutation = useCancelSellerOrderMutation();

    // FIX (Task 18): Prevent duplicate order mutations via synchronous lock.
    // Shared (not one lock per action) so that no two order mutations from
    // this hook -- including the pickup-request flow, extracted into its own
    // hook below -- can run at once. Passed into usePickupRequestFlow rather
    // than each hook owning its own lock, which would let a pickup request
    // and, say, a cancel run concurrently -- a real behavior change the
    // extraction must not introduce.
    const { runWithLock } = useAsyncLock();
    const [showPickupDialog, setShowPickupDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [readyAction, setReadyAction] = useState<'hub_dropoff' | 'shop_ready'>('hub_dropoff');
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { toast } = useToast();

    const pickupFlow = usePickupRequestFlow({ runWithLock });

    // Neither refreshOrders nor markAsDelivered (below) is called by any
    // handler in this hook, nor returned to a consumer -- confirmed dead
    // code carried over unchanged from the pre-split hook (each mutation's
    // own onSuccess already invalidates the relevant queries). Left in
    // place rather than silently deleted as a side effect of this
    // structural split -- that's a call for whoever owns this flow to make,
    // not an incidental cleanup.
    const refreshOrders = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.orders }),
            queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.analytics })
        ]);
    }, [queryClient]);

    // Filter orders based on search query
    const filteredOrders = useMemo(() => {
        if (!searchQuery.trim()) return orders;

        const query = searchQuery.toLowerCase();
        return orders.filter(order =>
            order.buyerName?.toLowerCase().includes(query) ||
            order.items?.some(item => item.name.toLowerCase().includes(query)) ||
            order.id?.toString().toLowerCase().includes(query) ||
            order.orderNumber?.toLowerCase().includes(query)
        );
    }, [orders, searchQuery]);

    const handleReadyForPickupClick = (orderId: string, action: 'hub_dropoff' | 'shop_ready' = 'hub_dropoff') => {
        setSelectedOrderId(orderId);
        setReadyAction(action);
        setShowPickupDialog(true);
    };

    const selectHubDropoff = async (orderId: string) => {
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await selectHubDropoffMutation.mutateAsync(orderId);
                toast({
                    title: 'Mzigo Ego drop-off selected',
                    description: 'Drop the package at Mzigo Ego within 24 hours, then mark it handed over.'
                });
            } catch (error) {
                const err = error as { message?: string; response?: { data?: { message?: string } } };
                toast({
                    title: 'Could not select Mzigo drop-off',
                    description: err.response?.data?.message || err.message || 'Please try again.',
                    variant: 'destructive'
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const markAsReadyForPickup = async () => {
        if (!selectedOrderId) return;

        setShowPickupDialog(false);
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);

                 if (readyAction === 'hub_dropoff') {
                    await markDroppedAtHubMutation.mutateAsync(selectedOrderId);
                } else {
                    await updateOrderStatusMutation.mutateAsync({ orderId: selectedOrderId, status: 'READY_FOR_BUYER' as OrderStatus });
                }

                toast({
                    title: readyAction === 'hub_dropoff' ? 'Package handed to Mzigo Ego' : 'Order ready for pickup',
                    description: readyAction === 'hub_dropoff'
                        ? 'Mzigo Ego will secure the package, check it against the order, and update the buyer.'
                        : 'The buyer has been notified that their order is ready for shop pickup.',
                });
            } catch (err) {
                console.error('Failed to update order status:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to mark order as ready for pickup. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
                setSelectedOrderId(null);
                setReadyAction('hub_dropoff');
            }
        });
    };

    const markAsDelivered = async (orderId: string) => {
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await updateOrderStatusMutation.mutateAsync({ orderId, status: 'DELIVERY_COMPLETE' as OrderStatus });

                toast({
                    title: 'Order Delivered',
                    description: 'The order has been marked as delivered.',
                });
            } catch (err) {
                console.error('Failed to update order status:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to mark order as delivered. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };
    void markAsDelivered;

    const markServiceReadyForBuyerConfirmation = async (orderId: string) => {
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await updateOrderStatusMutation.mutateAsync({ orderId, status: 'READY_FOR_BUYER' as OrderStatus });

                toast({
                    title: 'Service Delivered',
                    description: 'The buyer can now confirm completion to release the funds.',
                });
            } catch (err) {
                console.error('Failed to update order status:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to mark the service as delivered. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const confirmBooking = async (orderId: string) => {
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await confirmBookingMutation.mutateAsync(orderId);

                toast({
                    title: 'Booking Confirmed',
                    description: 'The service booking has been confirmed and the buyer has been notified.',
                });
            } catch (err) {
                console.error('Failed to confirm booking:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to confirm booking. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const handleCancelClick = (orderId: string) => {
        setCancellingOrderId(orderId);
        setShowCancelDialog(true);
    };

    const cancelOrder = async () => {
        if (!cancellingOrderId) return;

        setShowCancelDialog(false);

        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                const result = await cancelOrderMutation.mutateAsync(cancellingOrderId);

                toast({
                    title: 'Order Cancelled',
                    description: `The order has been cancelled. Buyer will receive a refund of KSh ${result.refundAmount?.toLocaleString() || '0'}.`,
                });
            } catch (err) {
                console.error('Failed to cancel order:', err);
                toast({
                    title: 'Error',
                    description: err.response?.data?.message || 'Failed to cancel order. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    return {
        isLoading,
        ordersQuery,
        orders,
        searchQuery,
        setSearchQuery,
        filteredOrders,
        isUpdating,
        handleReadyForPickupClick,
        openRequestPickupDialog: pickupFlow.openRequestPickupDialog,
        selectHubDropoff,
        markServiceReadyForBuyerConfirmation,
        confirmBooking,
        handleCancelClick,
        pickupOrder: pickupFlow.pickupOrder,
        closeRequestPickupDialog: pickupFlow.closeRequestPickupDialog,
        pickupDialogHelpText: pickupFlow.pickupDialogHelpText,
        requestPickup: pickupFlow.requestPickup,
        isPickupQuoteLoading: pickupFlow.isPickupQuoteLoading,
        pickupQuote: pickupFlow.pickupQuote,
        setPickupLocation: pickupFlow.setPickupLocation,
        pickupPhone: pickupFlow.pickupPhone,
        setPickupPhone: pickupFlow.setPickupPhone,
        isRequestingPickup: pickupFlow.isRequestingPickup,
        pickupQuoteError: pickupFlow.pickupQuoteError,
        showPickupDialog,
        setShowPickupDialog,
        readyAction,
        markAsReadyForPickup,
        showCancelDialog,
        setShowCancelDialog,
        cancelOrder,
    };
}
