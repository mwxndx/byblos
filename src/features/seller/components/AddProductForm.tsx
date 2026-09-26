import { useState, ChangeEvent, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useSellerProfileQuery } from '@/features/seller/hooks/useSellerProfile';
import { useCreateProductMutation, useUploadDigitalProductMutation } from '@/features/seller/hooks/useSellerProducts';
import { AddProductFormSteps } from './AddProductFormSteps';
import {
  formDataDefaults,
  processImage,
  hasServiceCoordinates,
  validateStep1,
  validateStep2,
  buildProductData,
  type AddProductFormData,
  type FormErrors,
} from '../utils/addProductFormUtils';
import { Sparkles } from '@/shared/ui/icons';

export const AddProductForm = ({ onSuccess, onClose }: { onSuccess: () => void; onClose?: () => void }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<AddProductFormData>({ ...formDataDefaults });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: sellerProfile = null } = useSellerProfileQuery();
  const hasCoordinates = hasServiceCoordinates(sellerProfile);

  useEffect(() => {
    if (!hasCoordinates && formData.product_type === 'service') {
      setFormData(prev => ({ ...prev, product_type: 'physical' }));
    }
  }, [hasCoordinates, formData.product_type]);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'description' && value.length > 300) return;
    clearError(name);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum image size is 10MB', variant: 'destructive' });
      return;
    }
    try {
      const processedImage = await processImage(file);
      if (slot === 0) {
        clearError('image');
        setImagePreview(processedImage);
        setFormData(prev => ({ ...prev, image: file, image_url: processedImage }));
      } else {
        const idx = slot - 1;
        setExtraFiles(prev => { const n = [...prev]; n[idx] = file; return n; });
        setExtraPreviews(prev => { const n = [...prev]; n[idx] = processedImage; return n; });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process image', variant: 'destructive' });
    }
  };

  const createProductMutation = useCreateProductMutation();
  const uploadDigitalProductMutation = useUploadDigitalProductMutation();

  // Single-screen form: validate every field at once, then scroll the first
  // error into view (there is no step to fall back to).
  const handleSubmit = async () => {
    const allErrors: FormErrors = {
      ...validateStep1(formData, hasCoordinates, !!imagePreview),
      ...validateStep2(formData),
    };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      requestAnimationFrame(() => {
        contentRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return;
    }
    setErrors({});

    setIsLoading(true);
    try {
      const digital = {
        path: formData.digital_file_path,
        name: formData.digital_file_name,
        size: formData.digital_file_size,
      };

      if (formData.is_digital && formData.digital_file) {
        const res = await uploadDigitalProductMutation.mutateAsync({
          file: formData.digital_file,
          onProgress: setUploadProgress,
        }) as Record<string, unknown>;
        digital.path = String(res.filePath);
        digital.name = String(res.fileName);
        digital.size = Number(res.size);
      }

      const productData = buildProductData(formData, sellerProfile?.id, extraPreviews, digital);

      await createProductMutation.mutateAsync(productData as unknown as Parameters<typeof createProductMutation.mutateAsync>[0]);
      toast({ title: 'Success', description: 'Product launched successfully!' });
      onSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to create product', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-label">
      {/* Header (chrome) */}
      <div className="shrink-0 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6 sm:pb-4">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">New product</h2>
        <p className="mt-0.5 text-sm text-label-2">Photos, price, and a short description.</p>
      </div>

      {/* Content — one scrolling form */}
      <div ref={contentRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
        <AddProductFormSteps
          formData={formData}
          setFormData={setFormData}
          handleChange={handleChange}
          errors={errors}
          clearError={clearError}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
          extraPreviews={extraPreviews}
          setExtraPreviews={setExtraPreviews}
          setExtraFiles={setExtraFiles}
          handleImageChange={handleImageChange}
          uploadProgress={uploadProgress}
          sellerProfile={sellerProfile}
          hasCoordinates={hasCoordinates}
        />
      </div>

      {/* Footer (chrome) */}
      <div className="shrink-0 border-t border-separator bg-surface-1/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        <Button onClick={handleSubmit} disabled={isLoading} className="h-11 w-full">
          {isLoading ? 'Launching…' : 'Launch product'}
          {!isLoading && <Sparkles className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default AddProductForm;
