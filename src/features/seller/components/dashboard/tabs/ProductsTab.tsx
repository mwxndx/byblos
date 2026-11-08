import { Megaphone, MoreHorizontal, Plus } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { formatCurrency } from '@/shared/utils/formatting';
import { SellerProfileHero } from '../../SellerProfileHero';
import { AddProductForm } from '../../AddProductForm';
import { ProductsList } from '../../ProductsList';
import type { ProductSummary } from '@/shared/types/view/productSummary';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import type { AnalyticsData } from '../types';

interface ProductsTabProps {
  fetchProducts: () => Promise<void>;
  isAddProductModalOpen: boolean;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct?: (id: string) => void;
  onStatusUpdate: (productId: string, newStatus: 'available' | 'sold') => Promise<void>;
  products: ProductSummary[];
  setIsAddProductModalOpen: (open: boolean) => void;
  sellerProfile?: SellerProfile | null;
  shopUsername?: string | null;
  onCopyShopLink?: () => void | Promise<void>;
  analytics?: AnalyticsData;
  balance?: number;
  revenue?: number;
  totalSales?: number;
  clicks?: number;
  wishlist?: number;
  creatorSales?: number;
}

export function ProductsTab({
  fetchProducts,
  isAddProductModalOpen,
  onDeleteProduct,
  onEditProduct,
  onStatusUpdate,
  products,
  setIsAddProductModalOpen,
  sellerProfile,
  shopUsername,
  onCopyShopLink,
  analytics,
  balance,
  revenue,
  totalSales,
  clicks,
  wishlist,
  creatorSales,
}: Readonly<ProductsTabProps>) {
  const hasProducts = products.length > 0;

  const currentBalance = balance ?? analytics?.availableBalance ?? analytics?.balance;
  const currentTotalSales = totalSales ?? analytics?.totalSales ?? 0;
  const currentRevenue = revenue ?? analytics?.totalRevenue ?? 0;
  const currentClicks = clicks ?? Number(analytics?.clickCount || 0);
  const currentWishlist = wishlist ?? Number(analytics?.wishlistCount || 0);
  const currentCreatorSales = creatorSales ?? Number(analytics?.creatorGeneratedSales || 0);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Shop profile hero with Sales (clicks below), Revenue (wishlist below), and Balance */}
      <SellerProfileHero
        sellerProfile={sellerProfile}
        shopUsername={shopUsername}
        onCopyShopLink={onCopyShopLink}
        canEdit
        balance={currentBalance}
        revenue={currentRevenue}
        totalSales={currentTotalSales}
        clicks={currentClicks}
        wishlist={currentWishlist}
      />

      {/* Creator sales recognition pill (only visible when creator sales exist) */}
      {currentCreatorSales > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-white/80">
            <Megaphone className="h-3 w-3" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            {formatCurrency(currentCreatorSales)} creator sales
          </span>
        </div>
      )}

      {/* Single controlled add-product dialog, opened from the action button or the empty-state plus. */}
      <Dialog open={isAddProductModalOpen} onOpenChange={setIsAddProductModalOpen}>
        <DialogContent className="flex flex-col w-[92vw] max-w-lg sm:max-w-[540px] h-[85dvh] max-h-[85dvh] sm:h-[min(84dvh,640px)] p-0 overflow-hidden border border-slate-200 dark:border-separator bg-white dark:bg-surface-1 rounded-3xl sm:rounded-[2rem] shadow-2xl [&>button]:z-30">
          <DialogHeader className="sr-only">
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Create and publish a new product to your Byblos shop</DialogDescription>
          </DialogHeader>
          <div className="product-modal-light flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <AddProductForm
              onSuccess={() => {
                void fetchProducts().catch(() => {});
                setIsAddProductModalOpen(false);
              }}
              onClose={() => setIsAddProductModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Action row with Add product button and three dots horizontally aligned on the same row */}
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          onClick={() => setIsAddProductModalOpen(true)}
          className="gap-1.5 bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)] hover:opacity-90 shadow-md px-3.5 py-1.5 rounded-lg font-semibold text-xs h-8 transition-transform active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          Add product
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Service charge description"
              title="Service charge description"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]"
            >
              <MoreHorizontal className="h-4 w-4" weight="bold" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3.5 text-xs leading-relaxed text-slate-700 dark:text-white/90 shadow-xl rounded-xl">
            Byblos adds a 2% service charge to each product price to keep products safe in transit, secure the transaction, and support our operations and maintenance.
          </PopoverContent>
        </Popover>
      </div>

      {hasProducts ? (
        <ProductsList
          products={products as import('@/shared/types').Product[]}
          onDelete={onDeleteProduct}
          onEdit={onEditProduct}
          onStatusUpdate={onStatusUpdate}
          onRefresh={fetchProducts}
        />
      ) : (
        /* Empty state: a single prominent plus that opens the creation flow. */
        <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <button
            type="button"
            onClick={() => setIsAddProductModalOpen(true)}
            aria-label="Add your first product"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)] shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-button-bg,#f5c518)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Plus className="h-10 w-10" strokeWidth={2.5} />
          </button>
          <p className="text-sm font-semibold text-label-2">Tap the plus to add your first product</p>
        </div>
      )}
    </div>
  );
}
