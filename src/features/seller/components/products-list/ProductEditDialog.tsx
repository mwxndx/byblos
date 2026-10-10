import type { ChangeEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { ArrowLeft, Loader2 } from '@/shared/ui/icons';
import { ProductEditPhotoSlots } from './ProductEditPhotoSlots';
import { ProductEditFormFields } from './ProductEditFormFields';

export interface ProductEditFormData {
  name: string;
  price: string;
  description: string;
  aesthetic: string;
  image: File | null;
  imagePreview: string;
  extraFiles: File[];
  extraPreviews: string[];
  product_type?: 'physical' | 'digital' | 'service';
  is_custom_product: boolean;
  production_days: string;
  customization_prompt: string;
  is_imported_product: boolean;
  import_days: string;
  import_note: string;
}

interface ProductEditDialogProps {
  open: boolean;
  formData: ProductEditFormData;
  isLoading: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: ProductEditFormData) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>, slot: number) => void;
  onRemoveImage: (slot: number) => void;
  onSave: () => void;
}

export function ProductEditDialog({
  open,
  formData,
  isLoading,
  isSaving,
  onOpenChange,
  onFormDataChange,
  onImageChange,
  onRemoveImage,
  onSave
}: ProductEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-surface-1 border border-slate-200 dark:border-separator text-slate-900 dark:text-white w-[90vw] max-w-sm sm:max-w-[400px] max-h-[78dvh] overflow-y-auto p-3 sm:p-4 rounded-xl shadow-2xl">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left mb-2">
          <IconButton
            variant="ghost"
            onClick={() => onOpenChange(false)}
            aria-label="Back"
            className="h-11 w-11 -ml-2 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:text-white hover:bg-white/10 rounded-full shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Edit Product</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-white/60 text-[10px] sm:text-xs font-medium">
              Update product information
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <ProductEditFormFields
              formData={formData}
              onFormDataChange={onFormDataChange}
            />

            <ProductEditPhotoSlots
              formData={formData}
              onImageChange={onImageChange}
              onRemoveImage={onRemoveImage}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-200 dark:border-white/20 bg-transparent text-slate-900 dark:text-white hover:bg-white/10 font-semibold"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || isLoading}
            className="bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)] hover:opacity-90 font-bold shadow-md"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
