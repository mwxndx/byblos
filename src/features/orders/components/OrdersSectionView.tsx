import { useMemo, useState } from 'react';
import { Package, RefreshCw, Search } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { ApiOrder } from '@/shared/types';
import { BuyerOrderCard } from './BuyerOrderCard';
import { BuyerOrderDialogs } from './BuyerOrderDialogs';
import { OrdersLoadingState } from '@/shared/ui/OrdersLoadingState';

export interface OrdersSectionViewProps {
  orders: ApiOrder[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  downloadingOrderId: string | null;
  downloadProgress: Record<string, number>;
  isConfirming: string | null;
  isCancelling: string | null;
  onConfirmReceiptClick: (orderId: string) => void;
  onCancelOrder: (orderId: string) => Promise<void>;
  onConfirmReceipt: (orderId: string) => Promise<void>;
  onDownload: (order: ApiOrder) => Promise<void>;
}

export function OrdersSectionView({
  orders,
  isLoading,
  error,
  refetch,
  downloadingOrderId,
  downloadProgress,
  isConfirming,
  isCancelling,
  onConfirmReceiptClick,
  onCancelOrder,
  onConfirmReceipt,
  onDownload,
}: OrdersSectionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<ApiOrder | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleConfirmClick = (orderId: string) => {
    setCurrentOrderId(orderId);
    onConfirmReceiptClick(orderId);
    setShowReceiptDialog(true);
  };

  const handleCancelSubmit = async () => {
    if (!currentOrderId) return;
    // Keep the dialog open during the request so the button's disabled/spinner
    // state (gated on isCancelling) is visible; close once it resolves.
    await onCancelOrder(currentOrderId);
    setShowCancelDialog(false);
  };

  const handleReceiptSubmit = async () => {
    if (!currentOrderId) return;
    setShowReceiptDialog(false);
    await onConfirmReceipt(currentOrderId);
  };

  const filteredOrders = useMemo(() => orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const orderNum = (order.orderNumber || order.id || '').toLowerCase();
    const shopName = (order.seller?.shopName || order.seller?.name || '').toLowerCase();
    const itemMatch = order.items.some(item => item.name.toLowerCase().includes(query));

    return orderNum.includes(query) || shopName.includes(query) || itemMatch;
  }), [orders, searchQuery]);

  if (isLoading) {
    return <OrdersLoadingState />;
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-200 mb-4">{error.message || 'Failed to load orders. Please try again later.'}</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar matching Penpot #27272c / #34343a / 14px radius */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 dark:text-[#8a8a91] pointer-events-none" />
        <Input
          type="text"
          aria-label="Search orders"
          placeholder="Search orders"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] pl-10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8a8a91] text-sm font-medium transition-colors"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-12 sm:py-16">
          <div className="max-w-md mx-auto rounded-[16px] p-8 bg-white dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] text-center space-y-4 shadow-sm transition-colors duration-200">
            <div className="w-[72px] h-[72px] mx-auto bg-[#f5c518]/15 border border-[#f5c518]/30 rounded-2xl flex items-center justify-center text-[#f5c518] shadow-sm">
              <Package className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              No orders found
            </h3>
            <p className="text-slate-600 dark:text-[#a1a1a6] text-sm leading-relaxed max-w-sm mx-auto">
              {searchQuery
                ? 'No orders match your search. Try different keywords.'
                : 'When you buy from a shop, your orders and their delivery progress show up here.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => { window.location.href = '/buyer/dashboard'; }}
                className="inline-flex items-center justify-center h-12 px-6 rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Browse Products
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <BuyerOrderCard
              key={order.id}
              order={order}
              downloadingOrderId={downloadingOrderId}
              downloadProgress={downloadProgress}
              onViewDetails={(o) => setSelectedOrderForDetails(o)}
              onConfirmReceipt={handleConfirmClick}
              onDownload={onDownload}
            />
          ))}
        </div>
      )}

      <BuyerOrderDialogs
        orders={filteredOrders}
        currentOrderId={currentOrderId}
        isConfirming={isConfirming}
        isCancelling={isCancelling}
        showCancelDialog={showCancelDialog}
        showReceiptDialog={showReceiptDialog}
        selectedOrderForDetails={selectedOrderForDetails}
        viewingImage={viewingImage}
        onCancelDialogChange={setShowCancelDialog}
        onReceiptDialogChange={setShowReceiptDialog}
        onSelectedOrderChange={setSelectedOrderForDetails}
        onViewingImageChange={setViewingImage}
        onCancelOrder={handleCancelSubmit}
        onConfirmReceipt={handleReceiptSubmit}
        onConfirmReceiptClick={handleConfirmClick}
      />
    </div>
  );
}
