import type { FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Truck, RefreshCw, CheckCircle, XCircle, Package, MapPin, CreditCard } from '@/shared/ui/icons';
import LocationPicker from '@/shared/components/LocationPicker';
import type { ApiOrder } from '@/shared/types';
import { formatCurrency, HUB_DROPOFF_LOCATION } from '../utils/sellerOrders.utils';

interface PickupQuote {
  feeAmount: number;
  distanceKm: number;
  chargeableDistanceKm: number;
  rateKesPerKm: number;
  currency: string;
  pricingModel?: string;
  cbdPickupFeeKes?: number;
  cbdRadiusKm?: number;
}

interface SellerOrderDialogsProps {
  pickupOrder: ApiOrder | null;
  closeRequestPickupDialog: () => void;
  pickupDialogHelpText: string;
  requestPickup: (event: FormEvent) => Promise<void>;
  isPickupQuoteLoading: boolean;
  pickupQuote: PickupQuote | null;
  setPickupLocation: React.Dispatch<React.SetStateAction<{ address: string; lat: number | null; lng: number | null }>>;
  pickupPhone: string;
  setPickupPhone: React.Dispatch<React.SetStateAction<string>>;
  isRequestingPickup: boolean;
  pickupQuoteError: string;
  showPickupDialog: boolean;
  setShowPickupDialog: React.Dispatch<React.SetStateAction<boolean>>;
  readyAction: 'hub_dropoff' | 'shop_ready';
  markAsReadyForPickup: () => Promise<void>;
  isUpdating: boolean;
  showCancelDialog: boolean;
  setShowCancelDialog: React.Dispatch<React.SetStateAction<boolean>>;
  cancelOrder: () => Promise<void>;
}

export function SellerOrderDialogs({
  pickupOrder,
  closeRequestPickupDialog,
  pickupDialogHelpText,
  requestPickup,
  isPickupQuoteLoading,
  pickupQuote,
  setPickupLocation,
  pickupPhone,
  setPickupPhone,
  isRequestingPickup,
  pickupQuoteError,
  showPickupDialog,
  setShowPickupDialog,
  readyAction,
  markAsReadyForPickup,
  isUpdating,
  showCancelDialog,
  setShowCancelDialog,
  cancelOrder,
}: Readonly<SellerOrderDialogsProps>) {
  return (
    <>
      {/* Seller Pickup Payment Dialog (Matching Penpot Seller - Request pickup) */}
      <Dialog open={!!pickupOrder} onOpenChange={(open) => !open && closeRequestPickupDialog()}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden w-[92vw] sm:max-w-md bg-[#27272c] border border-[#34343a] text-white rounded-[20px] shadow-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <div className="w-8 h-8 bg-[#f5c518] text-black rounded-full flex items-center justify-center font-bold">
                <Truck className="h-4 w-4" />
              </div>
              Request Pickup
            </DialogTitle>
            <DialogDescription className="text-sm text-[#a1a1a6] font-medium">
              {pickupDialogHelpText || 'A courier will collect the parcel and deliver it to the buyer. Your payment is released after delivery.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={requestPickup} className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-4 py-2 pb-8">
              {pickupOrder && (
                <div className="grid grid-cols-1 gap-2 rounded-[12px] border border-[#34343a] bg-[#121214] p-3 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-[#a1a1a6]">Order</p>
                    <p className="font-bold text-white">#{pickupOrder.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-[#a1a1a6]">Package</p>
                    <p className="font-bold text-white truncate">{pickupOrder.items?.[0]?.name || 'Physical product'}</p>
                  </div>
                  <div>
                    <p className="text-[#a1a1a6]">Pickup fee</p>
                    <p className="font-bold text-[#f5c518]">
                      {isPickupQuoteLoading ? 'Calculating...' : formatCurrency(pickupQuote?.feeAmount || 0, pickupQuote?.currency || 'KSH')}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-[12px] border border-[#34343a] bg-[#121214] p-3">
                <LocationPicker
                  label="Pickup Location"
                  detailedLabel="Full Pickup Address"
                  placeholder="Search pickup location..."
                  autoPopulate
                  onLocationChange={(address, coordinates) => {
                    setPickupLocation({
                      address,
                      lat: coordinates?.lat ?? null,
                      lng: coordinates?.lng ?? null
                    });
                  }}
                  className="[&_label]:!text-white [&_p]:!text-[#a1a1a6]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <Label htmlFor="pickup-phone" className="text-xs font-bold text-white">M-Pesa number for pickup fee</Label>
                  <Input
                    id="pickup-phone"
                    type="tel"
                    value={pickupPhone}
                    onChange={(event) => setPickupPhone(event.target.value)}
                    placeholder="0712345678"
                    className="bg-[#121214] border-[#34343a] text-white placeholder:text-[#a1a1a6] rounded-[12px]"
                    disabled={isRequestingPickup}
                  />
                </div>
                <div className="rounded-[12px] border border-[#f5c518]/30 bg-[#f5c518]/10 p-3 text-xs">
                  <div className="flex items-center gap-2 text-white">
                    <CreditCard className="h-4 w-4 text-[#f5c518]" />
                    <span className="font-bold">Seller pays pickup fee</span>
                  </div>
                  {pickupQuote && (
                    <p className="mt-2 text-[#a1a1a6] font-medium">
                      {pickupQuote.pricingModel === 'cbd_flat'
                        ? `Nairobi CBD flat pickup fee: ${formatCurrency(pickupQuote.feeAmount, pickupQuote.currency || 'KSH')}.`
                        : `${pickupQuote.chargeableDistanceKm} km billed at KSh ${pickupQuote.rateKesPerKm}/km.`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-[12px] border border-[#34343a] bg-[#121214] p-3 text-xs text-[#a1a1a6] font-medium">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#f5c518]" />
                <span>After the pickup fee is paid, Mzigo collects the package, secures it, and checks it against the order before delivery.</span>
              </div>

              {pickupQuoteError && (
                <p className="rounded-[10px] border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                  {pickupQuoteError}
                </p>
              )}
            </div>

            <DialogFooter className="sticky bottom-0 z-20 mt-3 gap-2 border-t border-[#34343a] bg-[#27272c] py-3.5 px-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={closeRequestPickupDialog}
                disabled={isRequestingPickup}
                className="bg-[#121214] border-[#34343a] text-white hover:bg-white/10 rounded-[12px] font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRequestingPickup || isPickupQuoteLoading}
                className="bg-[#f5c518] hover:bg-[#e5b510] text-black font-bold rounded-[12px] shadow-sm"
              >
                {isRequestingPickup ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending STK...
                  </>
                ) : (
                  'Pay pickup fee'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ready for Pickup Confirmation Dialog */}
      <Dialog open={showPickupDialog} onOpenChange={setShowPickupDialog}>
        <DialogContent className="w-[90vw] sm:max-w-sm bg-[#27272c] border border-[#34343a] text-white rounded-[16px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-400/20 rounded-full flex items-center justify-center">
                <Truck className="h-4 w-4 text-blue-400" />
              </div>
              {readyAction === 'hub_dropoff' ? 'Confirm Mzigo Ego Drop-off' : 'Confirm Shop Pickup Readiness'}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#a1a1a6] leading-relaxed font-medium">
              {readyAction === 'hub_dropoff'
                ? 'Have you handed this package to Mzigo Ego?'
                : 'Is this order ready for the buyer to collect at your shop?'}
            </DialogDescription>
          </DialogHeader>

          {readyAction === 'hub_dropoff' && (
            <div className="bg-[#121214] border border-[#34343a] rounded-[12px] p-4 my-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 border border-blue-400/20 rounded-full flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-white mb-1">Mzigo Ego drop-off location:</p>
                  <p className="text-[#a1a1a6] font-medium">
                    {HUB_DROPOFF_LOCATION}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#121214] border border-[#34343a] rounded-[12px] p-3 mb-4">
            <p className="text-xs text-yellow-300 font-semibold leading-relaxed">
              {readyAction === 'hub_dropoff'
                ? 'Please confirm only after Mzigo Ego has received the package. They will secure it and check it against the order before delivery.'
                : 'Please confirm only after the package is ready to hand over to the buyer.'}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowPickupDialog(false)}
              disabled={isUpdating}
              className="w-full sm:w-auto bg-[#121214] border-[#34343a] text-white hover:bg-white/10 h-9 text-xs font-semibold rounded-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={markAsReadyForPickup}
              disabled={isUpdating}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[10px] h-9 text-xs"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-2" />
                  {readyAction === 'hub_dropoff' ? 'Confirm Handoff' : 'Confirm Ready'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Dialog (Matching Penpot Seller - Cancel order) */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="w-[90vw] sm:max-w-[380px] bg-[#27272c] border border-[#34343a] text-white rounded-[16px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <div className="w-9 h-9 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              Cancel Order
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#a1a1a6] leading-relaxed font-medium">
              The buyer will receive a full refund and the order will be closed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isUpdating}
              className="bg-[#121214] border-[#34343a] text-white hover:bg-white/10 font-semibold rounded-[12px] h-10 text-xs sm:text-sm"
            >
              Keep Order
            </Button>
            <Button
              onClick={cancelOrder}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-[12px] h-10 text-xs sm:text-sm shadow-md"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
