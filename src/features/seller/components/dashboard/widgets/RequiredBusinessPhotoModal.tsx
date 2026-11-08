import { useState, useId } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Loader2, UploadCloud, LogOut, ImagePlus, ShieldAlert } from '@/shared/ui/icons';
import { useToast } from '@/shared/hooks/use-toast';
import { useUploadBusinessPhotoMutation } from '@/features/seller/hooks/useSellerProfile';
import type { SellerProfile } from '@/features/auth/types/authTypes';

interface RequiredBusinessPhotoModalProps {
  open: boolean;
  sellerProfile: SellerProfile | null;
  onLogout: () => void;
  onPhotoUploaded?: (avatarUrl: string) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function RequiredBusinessPhotoModal({
  open,
  sellerProfile,
  onLogout,
  onPhotoUploaded,
}: Readonly<RequiredBusinessPhotoModalProps>) {
  const { toast } = useToast();
  const fileInputId = useId();
  const uploadMutation = useUploadBusinessPhotoMutation();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fallbackInitial =
    sellerProfile?.shopName?.trim().charAt(0).toUpperCase() ||
    sellerProfile?.fullName?.trim().charAt(0).toUpperCase() ||
    'S';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a valid image file (PNG, JPG, WEBP).',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Business photo must be less than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const b64 = await fileToBase64(file);
      setSelectedPhoto(b64);
    } catch {
      toast({
        title: 'Error Reading Image',
        description: 'Could not process the selected image. Please try another.',
        variant: 'destructive',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleSavePhoto = async () => {
    if (!selectedPhoto) {
      toast({
        title: 'Photo Required',
        description: 'Please select a photo before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadMutation.mutateAsync(selectedPhoto);
      const newAvatarUrl = (res as { avatarUrl?: string; businessPhotoUrl?: string })?.avatarUrl ||
        (res as { data?: { avatarUrl?: string } })?.data?.avatarUrl ||
        selectedPhoto;
      onPhotoUploaded?.(newAvatarUrl);
      toast({
        title: 'Profile Photo Set!',
        description: 'Your business profile photo has been successfully saved.',
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast({
        title: 'Upload Failed',
        description: error.response?.data?.message || error.message || 'Failed to upload photo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-[92vw] max-w-md rounded-3xl border border-slate-200 dark:border-separator bg-white dark:bg-surface-1 p-6 text-slate-900 dark:text-white shadow-2xl [&>button]:hidden"
      >
        <DialogHeader className="space-y-3 text-center sm:text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/15 text-yellow-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Business Profile Photo Required
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600 dark:text-white/60 leading-relaxed">
            To protect buyers and ensure a trusted marketplace, all sellers on Byblos must have a business profile photo or shop logo before accessing their dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Circular Photo Preview & Picker */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative group">
              <div
                className="h-28 w-28 overflow-hidden rounded-full border-4 border-yellow-400 bg-slate-100 dark:bg-fill shadow-lg flex items-center justify-center"
              >
                {selectedPhoto ? (
                  <img
                    src={selectedPhoto}
                    alt="Selected business logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-slate-600 dark:text-white/70">
                    <span className="text-3xl font-extrabold text-yellow-600 dark:text-yellow-400">
                      {fallbackInitial}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <label
              htmlFor={fileInputId}
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-fill px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white transition hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95"
            >
              <ImagePlus className="h-4 w-4 text-yellow-500" />
              <span>{selectedPhoto ? 'Change Photo' : 'Select Photo'}</span>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={handleFileChange}
              />
            </label>
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              Supports JPG, PNG, WEBP &bull; Max 5MB
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              type="button"
              onClick={handleSavePhoto}
              disabled={!selectedPhoto || isUploading}
              className="btn-white btn-standard h-12 w-full rounded-2xl bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90 [data-theme=light]_&:bg-black [data-theme=light]_&:text-white [data-theme=light]_&:hover:bg-black/90 font-bold shadow-md transition disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading & Saving...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Save Photo & Enter Dashboard
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onLogout}
              disabled={isUploading}
              className="h-10 w-full rounded-2xl text-xs text-slate-600 dark:text-white/60 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
