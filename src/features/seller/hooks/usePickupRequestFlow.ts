import { useState, useEffect, useRef, type FormEvent } from 'react';
import type { ApiOrder } from '@/shared/types';
import { useToast } from '@/shared/hooks/use-toast';
import { useQuotePickupMutation, useRequestPickupMutation } from '@/features/seller/hooks/mutations/useSellerOrderMutations';
import { getEffectiveFulfillmentType } from '../utils/sellerOrders.utils';

interface UsePickupRequestFlowArgs {
  /** Shared with useSellerOrderActions's other order-mutating actions so the
   *  serialization behavior ("no two order mutations run at once") is
   *  unchanged by this split -- a fresh useAsyncLock() instance here would
   *  let a pickup request and, say, a cancel run concurrently, which is a
   *  real behavior change, not just a structural one. */
  runWithLock: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

/**
 * The "request a Mzigo Ego pickup" dialog flow: debounced fee quoting as the
 * seller edits phone/location, and the actual pickup request submission.
 * Extracted out of useSellerOrderActions (which had grown to ~430 lines
 * combining this with unrelated order list/status concerns) as a
 * self-contained, easily-testable-in-isolation piece -- pure structural
 * split, no behavior change.
 */
export function usePickupRequestFlow({ runWithLock }: UsePickupRequestFlowArgs) {
    const { toast } = useToast();
    const quotePickupMutation = useQuotePickupMutation();
    const requestPickupMutation = useRequestPickupMutation();

    // Store latest mutateAsync in a ref so the quote effect doesn't need the mutation as a dep
    const quotePickupRef = useRef(quotePickupMutation.mutateAsync);
    quotePickupRef.current = quotePickupMutation.mutateAsync;

    const [pickupOrder, setPickupOrder] = useState<ApiOrder | null>(null);
    const [pickupPhone, setPickupPhone] = useState('');
    const [pickupLocation, setPickupLocation] = useState<{ address: string; lat: number | null; lng: number | null }>({
        address: '',
        lat: null,
        lng: null
    });
    const [pickupQuote, setPickupQuote] = useState<{
        feeAmount: number;
        distanceKm: number;
        chargeableDistanceKm: number;
        rateKesPerKm: number;
        currency: string;
        pricingModel?: string;
        cbdPickupFeeKes?: number;
        cbdRadiusKm?: number;
    } | null>(null);
    const [pickupQuoteError, setPickupQuoteError] = useState('');
    const [isPickupQuoteLoading, setIsPickupQuoteLoading] = useState(false);
    const [isRequestingPickup, setIsRequestingPickup] = useState(false);

    useEffect(() => {
        if (!pickupOrder) {
            setPickupQuote(null);
            setPickupQuoteError('');
            setIsPickupQuoteLoading(false);
            return;
        }

        if (
            pickupLocation.lat === null ||
            pickupLocation.lng === null ||
            (pickupLocation.lat === 0 && pickupLocation.lng === 0)
        ) {
            setPickupQuote(null);
            setPickupQuoteError('');
            return;
        }

        const timer = window.setTimeout(async () => {
            setIsPickupQuoteLoading(true);
            setPickupQuoteError('');
            try {
                const quote = await quotePickupRef.current({
                    orderId: pickupOrder.id,
                    phone: pickupPhone,
                    address: pickupLocation.address,
                    lat: pickupLocation.lat,
                    lng: pickupLocation.lng
                });
                setPickupQuote({
                    feeAmount: Number(quote.feeAmount || 0),
                    distanceKm: Number(quote.distanceKm || 0),
                    chargeableDistanceKm: Number(quote.chargeableDistanceKm || 0),
                    rateKesPerKm: Number(quote.rateKesPerKm || 40),
                    currency: quote.currency || 'KES'
                });
            } catch (error) {
                const err = error as { message?: string; response?: { data?: { error?: string; message?: string } } };
                setPickupQuote(null);
                setPickupQuoteError(err.response?.data?.error || err.response?.data?.message || err.message || 'Could not calculate pickup fee');
            } finally {
                setIsPickupQuoteLoading(false);
            }
        }, 400);

        return () => window.clearTimeout(timer);
    }, [pickupOrder, pickupLocation.address, pickupLocation.lat, pickupLocation.lng, pickupPhone]);

    const openRequestPickupDialog = (order: ApiOrder) => {
        setPickupOrder(order);
        setPickupPhone('');
        setPickupLocation({ address: '', lat: null, lng: null });
        setPickupQuote(null);
        setPickupQuoteError('');
    };

    const closeRequestPickupDialog = () => {
        if (isRequestingPickup) return;
        setPickupOrder(null);
        setPickupPhone('');
        setPickupLocation({ address: '', lat: null, lng: null });
        setPickupQuote(null);
        setPickupQuoteError('');
    };

    const requestPickup = async (event: FormEvent) => {
        event.preventDefault();
        if (!pickupOrder) return;

        const phonePattern = /^(\+?254|0)[17]\d{8}$/;
        if (!phonePattern.test(pickupPhone.trim())) {
            setPickupQuoteError('Enter a valid M-Pesa number, for example 0712345678.');
            return;
        }

        if (!pickupLocation.address.trim() || pickupLocation.lat === null || pickupLocation.lng === null) {
            setPickupQuoteError('Pin the pickup location and enter the full pickup address.');
            return;
        }

        if (isPickupQuoteLoading) {
            setPickupQuoteError('Please wait while the pickup fee is calculated.');
            return;
        }

        if (!pickupQuote) {
            setPickupQuoteError(pickupQuoteError || 'Pickup fee could not be calculated.');
            return;
        }

        await runWithLock(async () => {
            try {
                setIsRequestingPickup(true);
                const idempotencyKey = `seller-pickup:${pickupOrder.id}:${Date.now()}`;
                await requestPickupMutation.mutateAsync({
                    orderId: pickupOrder.id,
                    phone: pickupPhone.trim(),
                    address: pickupLocation.address.trim(),
                    lat: pickupLocation.lat,
                    lng: pickupLocation.lng,
                    quote: {
                        ...pickupQuote,
                        idempotencyKey
                    }
                });
                setIsRequestingPickup(false);
                closeRequestPickupDialog();
            } catch (error) {
                const err = error as { message?: string; response?: { data?: { message?: string } } };
                setPickupQuoteError(err.response?.data?.message || err.message || 'Failed to request pickup');
                toast({
                    title: 'Pickup request failed',
                    description: err.response?.data?.message || err.message || 'Please try again.',
                    variant: 'destructive'
                });
            } finally {
                setIsRequestingPickup(false);
            }
        });
    };

    const pickupOrderIsPhysicalOnline = pickupOrder
        ? !pickupOrder.items?.some(item => item.productType === 'service' || item.productType === 'digital') && getEffectiveFulfillmentType(pickupOrder) === 'COURIER'
        : false;
    const pickupDialogHelpText = pickupOrderIsPhysicalOnline
        ? 'Choose pickup if you want Mzigo Ego to collect the package from your location. They will secure it and check it against the order before delivery.'
        : 'Mzigo pickup is only available for online shop courier orders.';

    return {
        pickupOrder,
        pickupPhone,
        setPickupPhone,
        pickupLocation,
        setPickupLocation,
        pickupQuote,
        pickupQuoteError,
        isPickupQuoteLoading,
        isRequestingPickup,
        openRequestPickupDialog,
        closeRequestPickupDialog,
        requestPickup,
        pickupDialogHelpText,
    };
}
