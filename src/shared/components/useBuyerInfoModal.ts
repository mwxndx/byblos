import { useState, useEffect } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { isValidEmail } from '@/features/auth/utils/authValidation';
import type { BuyerInfo, BuyerInfoModalProps } from './BuyerInfoModal';

export function useBuyerInfoModal({ isOpen, onClose, onSubmit, isLoading = false, theme = 'default', phoneNumber, initialData }: BuyerInfoModalProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    firstName: initialData?.fullName?.split(' ')[0] || '',
    lastName: initialData?.fullName?.split(' ').slice(1).join(' ') || '',
    email: initialData?.email || '',
    mobilePayment: initialData?.mobilePayment || phoneNumber || '',
    whatsappNumber: initialData?.whatsappNumber || phoneNumber || '',
    city: initialData?.city || 'Nairobi',
    location: initialData?.location || '',
  });

  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<BuyerInfo & { termsAccepted?: string }>>({});

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setBuyerInfo(prev => ({
        ...prev,
        ...initialData,
        firstName: initialData.fullName?.split(' ')[0] || prev.firstName,
        lastName: initialData.fullName?.split(' ').slice(1).join(' ') || prev.lastName,
        city: initialData.city || prev.city || 'Nairobi',
        mobilePayment: initialData.mobilePayment || phoneNumber || prev.mobilePayment,
        whatsappNumber: initialData.whatsappNumber || initialData.mobilePayment || phoneNumber || prev.whatsappNumber,
      }) as BuyerInfo);
    }
  }, [initialData, phoneNumber]);

  // Reset errors when modal opens
  useEffect(() => {
    if (isOpen) {
      setTermsAccepted(true);
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<BuyerInfo & { termsAccepted?: string }> = {};

    if (!buyerInfo.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!buyerInfo.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!buyerInfo.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(buyerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the Terms and Conditions to continue.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const effectiveWhatsapp = buyerInfo.whatsappNumber?.trim() || buyerInfo.mobilePayment?.trim() || phoneNumber;
      await onSubmit({
        ...buyerInfo,
        whatsappNumber: effectiveWhatsapp,
        fullName: `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim(),
        termsAccepted: true
      } as unknown as Parameters<typeof onSubmit>[0]);
      // Reset form on successful submission
      setBuyerInfo({
        firstName: '',
        lastName: '',
        email: '',
        mobilePayment: '',
        whatsappNumber: '',
        city: 'Nairobi',
        location: '',
      });
      setErrors({});
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to submit contact information',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setErrors({});
      onClose();
    }
  };

  const themeClasses = {
    bg: 'bg-white dark:bg-black border border-slate-200 dark:border-white/15',
    text: 'text-slate-950 dark:text-white',
    input: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/60 focus-visible:ring-yellow-400',
    label: 'text-slate-800 dark:text-white',
    button: 'bg-yellow-400 hover:bg-yellow-500 text-black font-bold',
    error: 'text-red-500'
  };

  return {
    buyerInfo,
    setBuyerInfo,
    errors,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    termsAccepted,
    setTermsAccepted,
    isTermsModalOpen,
    setIsTermsModalOpen,
    handleSubmit,
    handleClose,
    themeClasses,
  };
}
