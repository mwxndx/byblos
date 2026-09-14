import { useEffect, useState } from 'react';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import { useToast } from '@/shared/hooks/use-toast';

/**
 * Buyer self-service profile edits. Buyers may only change the two contact
 * numbers we actually need to reach them (mobile payment + WhatsApp); name,
 * email and location are shown read-only. Saving PATCHes just those fields.
 *
 * NOTE: Migrated from useBuyerAuth → useGlobalAuth (unified auth system).
 */
export function useBuyerProfileForm() {
  const { user: globalUser, updateProfile } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? globalUser.profile as BuyerProfile : null;
  const { toast } = useToast();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [mobilePayment, setMobilePayment] = useState<string>(user?.mobilePayment || '');
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user?.whatsappNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // useAuthRevalidation refetches the profile on tab focus / TTL expiry and
  // calls setUser with fresh data while this component stays mounted across
  // in-app navigation -- without this, the form's local state was set once
  // at mount and never resynced, so a background refresh (another device, an
  // admin edit, or simply a slow initial fetch resolving late) left the form
  // showing stale values. Saving from that stale form would then PATCH the
  // old value back over the newer one. Only resync while NOT actively
  // editing, so this can't clobber an in-progress edit -- same pattern as
  // useSellerSettingsForm.ts.
  useEffect(() => {
    if (!isEditingProfile) {
      setMobilePayment(user?.mobilePayment || '');
      setWhatsappNumber(user?.whatsappNumber || '');
    }
  }, [isEditingProfile, user?.mobilePayment, user?.whatsappNumber]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateProfile({ mobilePayment, whatsappNumber }, 'buyer');

      toast({
        title: 'Profile Updated',
        description: 'Your payment and WhatsApp numbers have been saved.',
      });

      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to update profile', error);
      toast({
        title: 'Update Failed',
        description: 'There was a problem saving your details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return {
    isEditingProfile, setIsEditingProfile,
    mobilePayment, setMobilePayment,
    whatsappNumber, setWhatsappNumber,
    isSavingProfile, handleSaveProfile,
  };
}
