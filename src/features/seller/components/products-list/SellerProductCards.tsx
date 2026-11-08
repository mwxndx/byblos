import { memo } from 'react';
import { Button } from '@/shared/ui/button';
import { EyeOff, Loader2, Package, Pencil, Trash2 } from '@/shared/ui/icons';
import type { Product } from '@/shared/types';
import type { ApiSellerProduct } from '@/shared/types/api/product';
import { cn, formatCurrency } from '@/shared/utils/formatting';

type ProductWithApiFields = Product & Partial<ApiSellerProduct>;

interface SellerProductCardsProps {
  products: ProductWithApiFields[];
  deletingId: string | null;
  updatingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusUpdate?: (productId: string, status: 'available' | 'sold') => void;
  onInventoryEdit: (product: ProductWithApiFields) => void;
}

/**
 * Rectangular product card for the seller dashboard:
 * - Square frame for product image
 * - Product name & description next to image
 * - Stock button to edit inventory instead of old edit button
 * - Pencil icon at top right corner to edit product
 * - Delete icon at bottom right corner
 * - Price & Mark as sold out / Mark as available button on the same row below image & description
 */
export const SellerProductCards = memo(function SellerProductCards({
  products,
  deletingId,
  updatingId,
  onEdit,
  onDelete,
  onStatusUpdate,
  onInventoryEdit,
}: SellerProductCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
      {products.map((product) => {
        const isSold = product.status === 'sold';
        const isDeleting = deletingId === product.id;
        const isUpdating = updatingId === product.id;

        return (
          <div
            key={product.id}
            data-testid={`product-card-${product.id}`}
            className="relative flex flex-col md:flex-row md:items-center md:justify-between rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-surface-1 p-3.5 sm:p-4 md:px-5 md:py-4 md:pr-16 shadow-sm hover:border-[var(--theme-accent,#f5c518)]/40 transition-colors gap-3.5 md:gap-6 lg:gap-8"
          >
            {/* Top right corner: Pencil icon */}
            <button
              type="button"
              onClick={() => onEdit(product.id)}
              aria-label="Edit product"
              title="Edit product"
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {/* Bottom right corner: Delete icon */}
            <button
              type="button"
              onClick={() => onDelete(product.id)}
              disabled={isDeleting}
              aria-label="Delete product"
              title="Delete product"
              className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>

            {/* Product image, name, description, and stock button */}
            <div className="flex flex-1 items-start md:items-center gap-3 sm:gap-4 md:gap-6 min-w-0 pr-9 md:pr-0">
              {/* Square frame product image */}
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/5">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-white/30">
                    <EyeOff className="h-6 w-6" />
                  </div>
                )}
              </div>

              {/* Product name, description, and stock button */}
              <div className="flex flex-1 flex-col md:flex-row md:items-center md:justify-between min-w-0 gap-2 md:gap-6 lg:gap-8">
                <div className="flex flex-col min-w-0 md:max-w-xs lg:max-w-md">
                  <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {product.name}
                  </h4>
                  {product.description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  )}
                </div>

                {/* Stock button allowing the seller to edit their stock instead of the edit button */}
                <div className="mt-1 md:mt-0 flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onInventoryEdit(product)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-white/80 transition-colors"
                    title="Edit stock"
                    aria-label="Edit stock"
                  >
                    <Package className="h-3.5 w-3.5 text-slate-500 dark:text-white/60" />
                    <span>
                      {product.track_inventory
                        ? `${product.quantity ?? 0} in stock`
                        : 'Stock: Not tracked'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-white/40 ml-0.5">· Edit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom section on mobile / same row on desktop: Price and Mark as sold out / Mark as available */}
            <div className="mt-3.5 pt-3 md:mt-0 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5 flex items-center gap-3 sm:gap-4 md:gap-5 lg:gap-6 pr-10 md:pr-0 shrink-0">
              <span className="font-semibold text-sm sm:text-base lg:text-lg tabular-nums text-slate-900 dark:text-white shrink-0">
                {formatCurrency(product.price)}
              </span>

              {onStatusUpdate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate(product.id, isSold ? 'available' : 'sold')}
                  disabled={isUpdating}
                  className={cn(
                    "h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-colors shrink-0",
                    isSold
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  )}
                >
                  {isUpdating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isSold ? (
                    'Mark as available'
                  ) : (
                    'Mark as sold out'
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
