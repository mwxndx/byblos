import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Input } from '@/shared/ui/input';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { Textarea } from '@/shared/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/utils/formatting';
import { aestheticCategories } from '@/features/shop/utils/aestheticCategoriesData';
import { Package, FileText, Sparkles, X, ImagePlus, Info, MapPin, CheckCircle2, Clock, ChevronDown } from '@/shared/ui/icons';
import type { AddProductFormData, FormErrors } from '../utils/addProductFormUtils';

interface AddProductFormStepsProps {
  formData: AddProductFormData;
  setFormData: Dispatch<SetStateAction<AddProductFormData>>;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  errors: FormErrors;
  clearError: (field: string) => void;
  imagePreview: string;
  setImagePreview: Dispatch<SetStateAction<string>>;
  extraPreviews: string[];
  setExtraPreviews: Dispatch<SetStateAction<string[]>>;
  setExtraFiles: Dispatch<SetStateAction<File[]>>;
  handleImageChange: (e: ChangeEvent<HTMLInputElement>, slot: number) => void;
  uploadProgress: number;
  sellerProfile?: { city?: string | null; latitude?: number | null; longitude?: number | null } | null;
  hasCoordinates: boolean;
}

const fieldLabel = 'text-sm font-medium text-label-2';
const errorText = 'text-[13px] text-sys-red';

const ErrorNote = ({ id, message }: { id?: string; message?: string }) =>
  message ? <p id={id} className={errorText} role="alert">{message}</p> : null;

/**
 * Single-screen add-product fields (formerly a 2-step wizard). Order follows
 * importance: type, photos, name, price, description are always visible; the
 * type-specific extras appear inline for digital/service, and the physical
 * production/import options stay collapsed behind a disclosure since most
 * items are neither custom nor imported. Category is demoted below.
 */
export const AddProductFormSteps = ({
  formData,
  setFormData,
  handleChange,
  errors,
  clearError,
  imagePreview,
  setImagePreview,
  extraPreviews,
  setExtraPreviews,
  setExtraFiles,
  handleImageChange,
  uploadProgress,
  sellerProfile,
  hasCoordinates,
}: AddProductFormStepsProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const allPreviewsCombined = () => [imagePreview, ...extraPreviews].filter(Boolean);
  // Keep the disclosure open whenever an option inside it is actually active,
  // so toggling something on and then collapsing can never hide a live setting.
  const physicalOptionsOpen = advancedOpen || formData.is_custom_product || formData.is_imported_product;

  const typeOptions = [
    { id: 'physical' as const, label: 'Physical', icon: Package },
    { id: 'digital' as const, label: 'Digital', icon: FileText },
    { id: 'service' as const, label: 'Service', icon: Sparkles },
  ].filter(type => {
    if (isNativeApp() && type.id === 'digital') return false;
    if (type.id === 'service' && !hasCoordinates) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Product type */}
      <div className="space-y-1.5">
        <span className={fieldLabel}>Product type</span>
        <div role="tablist" aria-label="Product type" className="flex gap-1 rounded-control bg-fill p-1">
          {typeOptions.map(type => {
            const active = formData.product_type === type.id;
            return (
              <button
                key={type.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  clearError('product_type');
                  setFormData(p => ({ ...p, product_type: type.id, is_digital: type.id === 'digital' }));
                }}
                className={cn(
                  'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[7px] text-sm font-medium transition-colors ease-ios',
                  active ? 'bg-surface-1 text-label shadow-sm' : 'text-label-2 hover:text-label'
                )}
              >
                <type.icon className="h-4 w-4" />
                {type.label}
              </button>
            );
          })}
        </div>
        <ErrorNote message={errors.product_type} />
      </div>

      {/* Photos */}
      <div className="space-y-1.5">
        <label className={fieldLabel}>Photos</label>
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map(slot => {
            const preview = slot === 0 ? imagePreview : extraPreviews[slot - 1];
            const combined = allPreviewsCombined();
            const isDisabled = slot > 0 && !combined[slot - 1];
            return (
              <div key={slot} className="relative aspect-square">
                {preview ? (
                  <div className="relative h-full w-full">
                    <img src={preview} alt={slot === 0 ? 'Main photo' : 'Extra photo'} className="h-full w-full rounded-card object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => {
                        if (slot === 0) { setImagePreview(''); setFormData(p => ({ ...p, image: null, image_url: '' })); }
                        else { setExtraPreviews(p => p.filter((_, i) => i !== slot - 1)); setExtraFiles(p => p.filter((_, i) => i !== slot - 1)); }
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-sys-red p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className={cn(
                    'flex h-full flex-col items-center justify-center gap-1 rounded-card border border-dashed transition-colors',
                    isDisabled ? 'cursor-not-allowed border-separator opacity-40' : 'cursor-pointer border-separator-strong bg-surface-1 hover:bg-fill'
                  )}>
                    {!isDisabled && <input type="file" className="hidden" onChange={e => handleImageChange(e, slot)} accept="image/*" />}
                    <ImagePlus className="h-5 w-5 text-label-3" />
                    <span className="text-[11px] font-medium text-label-2">{slot === 0 ? 'Main' : 'Extra'}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <ErrorNote message={errors.image} />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="ap-name" className={fieldLabel}>Name</label>
        <Input
          id="ap-name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Vintage leather watch"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'ap-name-err' : undefined}
        />
        <ErrorNote id="ap-name-err" message={errors.name} />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <label htmlFor="ap-price" className={fieldLabel}>Price (KES)</label>
        <Input
          id="ap-price"
          type="number"
          name="price"
          min={50}
          value={formData.price}
          onChange={handleChange}
          placeholder="0.00"
          aria-invalid={!!errors.price}
          aria-describedby={errors.price ? 'ap-price-err' : undefined}
        />
        <ErrorNote id="ap-price-err" message={errors.price} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="ap-desc" className={fieldLabel}>Description</label>
          <span className="text-[13px] text-label-3">{formData.description.length}/300</span>
        </div>
        <Textarea
          id="ap-desc"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe what makes this product special…"
          className="min-h-[100px]"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'ap-desc-err' : undefined}
        />
        <ErrorNote id="ap-desc-err" message={errors.description} />
      </div>

      {/* Digital: required upload */}
      {formData.product_type === 'digital' && (
        <div className="space-y-3 rounded-card border border-separator bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className={fieldLabel}>Upload digital content</span>
            <span className="text-[13px] text-label-3">Max 500MB</span>
          </div>
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.gif,.bmp,.tiff,.heic,.zip,.rar,.7z,.epub,.mobi,.doc,.docx,.txt,.mp3,.wav,.mp4"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) setFormData(p => ({ ...p, digital_file: file }));
            }}
            className="h-11 cursor-pointer pt-2.5"
          />
          <p className="text-[13px] text-label-3">Images, PDFs, archives (ZIP, RAR), audio, and eBooks are supported.</p>
          {uploadProgress > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
              <div className="h-full bg-brand transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <div className="flex items-start gap-2.5 rounded-control bg-[color-mix(in_srgb,var(--sys-orange)_12%,transparent)] p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sys-orange" />
            <p className="text-[13px] font-medium leading-relaxed text-label-2">
              Digital products are assets like PDFs, music, or software. For a physical item (e.g. headphones), use the Physical type.
            </p>
          </div>
        </div>
      )}

      {/* Service: required schedule */}
      {formData.product_type === 'service' && (
        <div className="space-y-4 rounded-card border border-separator bg-surface-1 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={fieldLabel}>Start time</label>
              <Input type="time" value={formData.service_options.start_time} onChange={e => setFormData(p => ({ ...p, service_options: { ...p.service_options, start_time: e.target.value } }))} />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabel}>End time</label>
              <Input type="time" value={formData.service_options.end_time} onChange={e => setFormData(p => ({ ...p, service_options: { ...p.service_options, end_time: e.target.value } }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
              const on = formData.service_options.availability_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const days = formData.service_options.availability_days;
                    const newDays = on ? days.filter(d => d !== day) : [...days, day];
                    setFormData(p => ({ ...p, service_options: { ...p.service_options, availability_days: newDays } }));
                  }}
                  className={cn(
                    'min-h-[36px] rounded-control px-3 text-sm font-medium transition-colors',
                    on ? 'bg-brand text-brand-on' : 'bg-fill text-label-2 hover:text-label'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Physical: optional production / import time, collapsed by default */}
      {formData.product_type === 'physical' && (
        <div className="rounded-card border border-separator bg-surface-1">
          <button
            type="button"
            onClick={() => setAdvancedOpen(o => !o)}
            aria-expanded={physicalOptionsOpen}
            className="flex w-full items-start justify-between gap-3 p-4 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-label">
                <Clock className="h-4 w-4 text-label-2" />
                Production or import time
              </span>
              <span className="mt-0.5 block text-[13px] text-label-3">Custom-made or imported? Set a ready time buyers see before paying.</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {!physicalOptionsOpen && <span className="text-[13px] text-label-3">Optional</span>}
              <ChevronDown className={cn('h-4 w-4 text-label-2 transition-transform', physicalOptionsOpen && 'rotate-180')} />
            </span>
          </button>

          {physicalOptionsOpen && (
            <div className="border-t border-separator">
              <label className="flex cursor-pointer items-start justify-between gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-label">Custom product</span>
                  <span className="mt-0.5 block text-[13px] text-label-3">Buyer submits instructions before payment.</span>
                </span>
                <input
                  type="checkbox"
                  checked={formData.is_custom_product}
                  onChange={event => {
                    clearError('production_days'); clearError('customization_prompt');
                    setFormData(p => ({ ...p, is_custom_product: event.target.checked, is_imported_product: event.target.checked ? false : p.is_imported_product }));
                  }}
                  className="mt-0.5 h-5 w-5 accent-yellow-400"
                />
              </label>

              <div className="h-px bg-separator" />

              <label className="flex cursor-pointer items-start justify-between gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-label">Imported / pre-order item</span>
                  <span className="mt-0.5 block text-[13px] text-label-3">Buyer sees the estimated ready time before paying.</span>
                </span>
                <input
                  type="checkbox"
                  checked={formData.is_imported_product}
                  onChange={event => {
                    clearError('import_days');
                    setFormData(p => ({ ...p, is_imported_product: event.target.checked, is_custom_product: event.target.checked ? false : p.is_custom_product }));
                  }}
                  className="mt-0.5 h-5 w-5 accent-yellow-400"
                />
              </label>

              {formData.is_custom_product && (
                <div className="space-y-3 border-t border-separator p-4">
                  <div className="space-y-1.5">
                    <label className={fieldLabel}>Production days</label>
                    <Select value={formData.production_days} onValueChange={value => { clearError('production_days'); setFormData(p => ({ ...p, production_days: value })); }}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(day => (
                          <SelectItem key={day} value={String(day)}>{day} {day === 1 ? 'day' : 'days'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ErrorNote message={errors.production_days} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ap-prompt" className={fieldLabel}>Buyer instruction prompt</label>
                    <Textarea
                      id="ap-prompt"
                      value={formData.customization_prompt}
                      onChange={event => { clearError('customization_prompt'); setFormData(p => ({ ...p, customization_prompt: event.target.value })); }}
                      className="min-h-[72px]"
                      placeholder="Tell the seller exactly what you want customized."
                      aria-invalid={!!errors.customization_prompt}
                    />
                    <ErrorNote message={errors.customization_prompt} />
                  </div>
                  <p className="rounded-control bg-[color-mix(in_srgb,var(--sys-orange)_12%,transparent)] px-3 py-2 text-[13px] font-medium leading-relaxed text-label-2">
                    Buyers see: made in up to {formData.production_days} {Number(formData.production_days) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
                  </p>
                </div>
              )}

              {formData.is_imported_product && (
                <div className="space-y-3 border-t border-separator p-4">
                  <div className="space-y-1.5">
                    <label className={fieldLabel}>Estimated ready time</label>
                    <Select value={formData.import_days} onValueChange={value => { clearError('import_days'); setFormData(p => ({ ...p, import_days: value })); }}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[7, 14, 21, 30].map(day => (
                          <SelectItem key={day} value={String(day)}>{day} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ErrorNote message={errors.import_days} />
                  </div>
                  <p className="rounded-control bg-[color-mix(in_srgb,var(--sys-orange)_12%,transparent)] px-3 py-2 text-[13px] font-medium leading-relaxed text-label-2">
                    Buyers see: imported item, ready in up to {formData.import_days} days. Delivery starts after seller handoff.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Category (secondary) */}
      <div className="space-y-1.5">
        <label className={fieldLabel}>Category</label>
        <Select value={formData.aesthetic} onValueChange={v => setFormData(p => ({ ...p, aesthetic: v }))}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aestheticCategories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live preview */}
      {imagePreview && (
        <div className="flex items-center gap-3 rounded-card border border-separator bg-surface-1 p-3">
          <img src={imagePreview} alt="Product preview" className="h-14 w-14 shrink-0 rounded-control object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-label">{formData.name || 'Your product'}</span>
              <span className="shrink-0 text-sm font-medium text-brand-text">KES {formData.price || '0'}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-label-3">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{sellerProfile?.city || 'Your shop'}</span>
              <span>·</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-sys-green" />
              <span>Safe checkout</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
