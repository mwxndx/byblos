import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Loader2, Package } from '@/shared/ui/icons';
import type { Product } from '@/shared/types';
import { cn } from '@/shared/utils/formatting';

interface ProductInventoryDialogProps {
  open: boolean;
  selectedProduct: Product | null;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  updatingStock: boolean;
  onOpenChange: (open: boolean) => void;
  onStockQuantityChange: (value: number) => void;
  onLowStockThresholdChange: (value: number) => void;
  onTrackInventoryChange: (value: boolean) => void;
  onSave: () => void;
}

const STATUS_META = {
  out: { label: 'Out of stock', className: 'text-sys-red bg-[color-mix(in_srgb,var(--sys-red)_16%,transparent)]' },
  low: { label: 'Low stock', className: 'text-sys-orange bg-[color-mix(in_srgb,var(--sys-orange)_16%,transparent)]' },
  ok: { label: 'In stock', className: 'text-sys-green bg-[color-mix(in_srgb,var(--sys-green)_16%,transparent)]' },
} as const;

export function ProductInventoryDialog({
  open,
  selectedProduct,
  stockQuantity,
  lowStockThreshold,
  trackInventory,
  updatingStock,
  onOpenChange,
  onStockQuantityChange,
  onLowStockThresholdChange,
  onTrackInventoryChange,
  onSave,
}: ProductInventoryDialogProps) {
  const status = stockQuantity === 0 ? 'out' : stockQuantity <= lowStockThreshold ? 'low' : 'ok';
  const statusMeta = STATUS_META[status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Package className="h-5 w-5 text-label-2" />
            Manage inventory
          </DialogTitle>
          <DialogDescription>Update stock for {selectedProduct?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between gap-3 rounded-card border border-separator bg-surface-1 p-4">
            <div className="min-w-0">
              <span className="block text-sm font-medium text-label">Track inventory</span>
              <span className="mt-0.5 block text-[13px] text-label-3">Enable stock tracking for this product.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={trackInventory}
              aria-label="Track inventory"
              onClick={() => onTrackInventoryChange(!trackInventory)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ease-ios',
                trackInventory ? 'bg-brand' : 'bg-fill-2'
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ease-ios',
                  trackInventory ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {trackInventory && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="inv-stock" className="text-sm font-medium text-label-2">Current stock</label>
                  <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-medium', statusMeta.className)}>
                    {statusMeta.label}
                  </span>
                </div>
                <Input
                  id="inv-stock"
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(event) => onStockQuantityChange(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="inv-threshold" className="text-sm font-medium text-label-2">Low-stock alert</label>
                <Input
                  id="inv-threshold"
                  type="number"
                  min="1"
                  value={lowStockThreshold}
                  onChange={(event) => onLowStockThresholdChange(Math.max(1, Number.parseInt(event.target.value, 10) || 5))}
                  placeholder="5"
                />
                <p className="text-[13px] text-label-3">Email alert when stock falls to or below this level.</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={updatingStock}>
            {updatingStock ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
