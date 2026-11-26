import { useState } from 'react';
import { Loader2, Trash2, UploadCloud } from '@/shared/ui/icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/hooks/use-toast';
import { getImageUrl } from '@/shared/utils/formatting';
import { useUploadBannerMutation, useUploadBusinessPhotoMutation } from '@/features/seller/hooks/useSellerProfile';

export const SELLER_BANNER_DIMENSIONS = '1200 × 400 px (3:1)';

interface SellerMediaEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarUrl?: string;
  bannerUrl?: string | null;
  fallbackInitial: string;
  mode?: 'photo' | 'banner';
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
});

const previewSrc = (url?: string | null) => {
  if (!url) return '';
  return url.startsWith('blob:') || url.startsWith('data:') ? url : getImageUrl(url);
};

export function SellerMediaEditDialog({
  open,
  onOpenChange,
  avatarUrl,
  bannerUrl,
  fallbackInitial,
  mode = 'photo',
}: Readonly<SellerMediaEditDialogProps>) {
  const photoMutation = useUploadBusinessPhotoMutation();
  const bannerMutation = useUploadBannerMutation();
  const [busy, setBusy] = useState<null | 'photo' | 'banner'>(null);

  const isBannerMode = mode === 'banner';
  const activeField = isBannerMode ? 'banner' : 'photo';

  const runUpload = async (
    file: File | null,
    maxMb: number,
    upload: (b64: string) => Promise<unknown>,
    label: string
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please choose an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast({ title: 'File too large', description: `Maximum ${label.toLowerCase()} size is ${maxMb}MB.`, variant: 'destructive' });
      return;
    }
    setBusy(activeField);
    try {
      const b64 = await fileToBase64(file);
      await upload(b64);
      toast({ title: `${label} updated`, description: `Your ${label.toLowerCase()} has been saved.` });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: err.response?.data?.message || `Failed to update ${label.toLowerCase()}.`, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runRemove = async (
    upload: (b64: string) => Promise<unknown>,
    label: string
  ) => {
    setBusy(activeField);
    try {
      await upload('');
      toast({ title: `${label} removed` });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: err.response?.data?.message || `Failed to remove ${label.toLowerCase()}.`, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const photoPreview = previewSrc(avatarUrl);
  const bannerPreview = previewSrc(bannerUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm sm:max-w-[400px] border border-slate-200 dark:border-separator bg-white dark:bg-surface-1 text-slate-950 dark:text-white">
        <DialogHeader>
          <DialogTitle className="text-slate-950 dark:text-white font-bold">
            {isBannerMode ? 'Edit Shop Banner' : 'Edit Business Photo'}
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-white/55 font-medium">
            {isBannerMode
              ? `Upload a wide banner for your dashboard and shop page. Recommended dimensions: ${SELLER_BANNER_DIMENSIONS}.`
              : 'Update how your shop logo/photo looks to buyers.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isBannerMode ? (
            <div className="space-y-3">
              <div className="h-28 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-[#141414]">
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Shop banner preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-500 dark:text-white/50">
                    No banner set ({SELLER_BANNER_DIMENSIONS})
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="btn-standard relative h-8 font-bold bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 [data-theme=light]_&:bg-black [data-theme=light]_&:text-white [data-theme=light]_&:hover:bg-black/90"
                  disabled={busy === 'banner'}
                >
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload shop banner"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    disabled={busy === 'banner'}
                    onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; void runUpload(f, 5, (b) => bannerMutation.mutateAsync(b), 'Shop banner'); }}
                  />
                  {busy === 'banner' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 h-3.5 w-3.5" />}
                  Upload
                </Button>
                {bannerUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-slate-200 dark:border-separator bg-slate-100 dark:bg-white/[0.04] text-slate-900 dark:text-white hover:bg-white/10"
                    disabled={busy === 'banner'}
                    onClick={() => { void runRemove((b) => bannerMutation.mutateAsync(b), 'Shop banner'); }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-slate-300 dark:border-white/20 bg-white dark:bg-[#141414]"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Business photo" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-xl font-semibold bg-black text-white dark:bg-white dark:text-black"
                  >
                    {fallbackInitial}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Business photo</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="btn-standard relative h-8 font-bold bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 [data-theme=light]_&:bg-black [data-theme=light]_&:text-white [data-theme=light]_&:hover:bg-black/90"
                    disabled={busy === 'photo'}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      disabled={busy === 'photo'}
                      onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; void runUpload(f, 5, (b) => photoMutation.mutateAsync(b), 'Business photo'); }}
                    />
                    {busy === 'photo' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 h-3.5 w-3.5" />}
                    Upload
                  </Button>
                  {avatarUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-slate-200 dark:border-separator bg-slate-100 dark:bg-white/[0.04] text-slate-900 dark:text-white hover:bg-white/10"
                      disabled={busy === 'photo'}
                      onClick={() => { void runRemove((b) => photoMutation.mutateAsync(b), 'Business photo'); }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
