import { ImagePlus, X } from '@/shared/ui/icons';
import { Label } from '@/shared/ui/label';
import type { ProductEditFormData } from './ProductEditDialog';

interface ProductEditPhotoSlotsProps {
  formData: ProductEditFormData;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>, slot: number) => void;
  onRemoveImage: (slot: number) => void;
}

export function ProductEditPhotoSlots({
  formData,
  onImageChange,
  onRemoveImage,
}: ProductEditPhotoSlotsProps) {
  const allPreviews = [formData.imagePreview, ...formData.extraPreviews];
  const activeCount = allPreviews.filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="seller-label font-semibold">Product Photos</Label>
        <span className="text-[10px] font-semibold text-slate-500 dark:text-white/60">
          {activeCount} / 3 photos
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        {Array.from({ length: 3 }).map((_, slot) => {
          const preview = allPreviews[slot];
          const isFirst = slot === 0;
          const isDisabled = slot > 0 && !allPreviews[slot - 1];

          return (
            <div key={slot} className="relative aspect-square">
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt={`Photo ${slot + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-separator"
                  />
                  {isFirst && (
                    <span className="absolute bottom-1 left-1 text-[8px] font-bold bg-emerald-600 text-slate-900 dark:text-white px-1 rounded-sm">
                      Main
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveImage(slot)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-slate-900 dark:text-white rounded-full h-5 w-5 flex items-center justify-center shadow-md transition-colors z-10"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </>
              ) : (
                <label
                  className={`w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-200 ${isDisabled
                    ? 'border-slate-200 dark:border-separator bg-slate-100 dark:bg-white/[0.02] cursor-not-allowed opacity-40'
                    : 'border-slate-200 dark:border-white/20 bg-fill hover:border-emerald-500 hover:bg-emerald-400/5 cursor-pointer'
                  }`}
                >
                  <ImagePlus className={`h-4 w-4 mb-1 ${isDisabled ? 'text-slate-500 dark:text-white/40' : 'text-slate-900 dark:text-white'}`} />
                  <span className={`text-[8px] font-bold ${isDisabled ? 'text-slate-500 dark:text-white/40' : 'text-slate-900 dark:text-white'}`}>
                    {isFirst ? 'Main photo' : `Photo ${slot + 1}`}
                  </span>
                  {!isDisabled && (
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => onImageChange(event, slot)}
                    />
                  )}
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 dark:text-white/60 mt-2 font-medium">PNG, JPG up to 5MB.</p>
    </div>
  );
}
