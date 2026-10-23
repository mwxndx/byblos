import React from 'react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Loader2, User, Mail, Phone } from '@/shared/ui/icons';
import { locationData } from '@/shared/utils/constants';
import type { BuyerInfo } from './BuyerInfoModal';

interface BuyerInfoFormProps {
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleClose: () => void;
  buyerInfo: BuyerInfo;
  setBuyerInfo: React.Dispatch<React.SetStateAction<BuyerInfo>>;
  errors: Partial<BuyerInfo & { termsAccepted?: string }>;
  showPassword?: boolean;
  setShowPassword?: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirmPassword?: boolean;
  setShowConfirmPassword?: React.Dispatch<React.SetStateAction<boolean>>;
  termsAccepted: boolean;
  setTermsAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTermsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checkPasswordStrength?: (password: string) => { minLength: boolean; hasNumber: boolean; hasSpecial: boolean; hasUpper: boolean; hasLower: boolean };
  themeClasses: Record<string, string>;
  isLoading: boolean;
}

export function BuyerInfoForm({
  handleSubmit,
  handleClose,
  buyerInfo,
  setBuyerInfo,
  errors,
  termsAccepted,
  setTermsAccepted,
  setIsTermsModalOpen,
  themeClasses,
  isLoading,
}: BuyerInfoFormProps) {
  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85dvh] sm:max-h-[90dvh] w-full">
      <DialogHeader className="p-4 sm:p-6 lg:p-8 pb-3 shrink-0 space-y-4">
        <div className="mx-auto w-14 h-14 bg-yellow-50 border border-yellow-100 rounded-2xl flex items-center justify-center shadow-inner">
          <User className="h-7 w-7 text-yellow-400" />
        </div>
        <div className="space-y-2">
          <DialogTitle className="text-2xl font-semibold text-center text-slate-950 dark:text-white">DELIVERY & CONTACT</DialogTitle>
          <DialogDescription className="text-[11px] text-center font-bold text-slate-600 dark:text-white uppercase tracking-wider opacity-80 leading-relaxed px-4">
            Used for your digital receipt, M-Pesa prompt, and delivery
          </DialogDescription>
        </div>
      </DialogHeader>

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-2 space-y-4 overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
              First Name *
            </Label>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              placeholder="e.g. John"
              value={buyerInfo.firstName}
              onChange={(e) => setBuyerInfo(prev => ({ ...prev, firstName: e.target.value }))}
              className={`h-11 text-sm rounded-xl ${themeClasses.input} ${errors.firstName ? 'border-red-500' : ''}`}
              disabled={isLoading}
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
            />
            {errors.firstName && (
              <p id="firstName-error" className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.firstName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName" className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
              Last Name *
            </Label>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              placeholder="e.g. Doe"
              value={buyerInfo.lastName}
              onChange={(e) => setBuyerInfo(prev => ({ ...prev, lastName: e.target.value }))}
              className={`h-11 text-sm rounded-xl ${themeClasses.input} ${errors.lastName ? 'border-red-500' : ''}`}
              disabled={isLoading}
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
            />
            {errors.lastName && (
              <p id="lastName-error" className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
            Email Address *
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Mail className="h-4 w-4 text-slate-400" />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={buyerInfo.email}
              onChange={(e) => setBuyerInfo(prev => ({ ...prev, email: e.target.value }))}
              className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.email ? 'border-red-500' : ''}`}
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </div>
          {errors.email && (
            <p id="email-error" className={`text-[10px] font-bold ${themeClasses.error}`}>{errors.email}</p>
          )}
        </div>

        {/* Phone numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mobilePayment" className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
              M-Pesa Number *
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Phone className="h-4 w-4 text-slate-400" />
              </div>
              <Input
                id="mobilePayment"
                name="mobilePayment"
                type="tel"
                autoComplete="tel"
                placeholder="07..."
                value={buyerInfo.mobilePayment}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, mobilePayment: e.target.value }))}
                className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input} ${errors.mobilePayment ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsappNumber" className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
              WhatsApp (Optional)
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Phone className="h-4 w-4 text-slate-400" />
              </div>
              <Input
                id="whatsappNumber"
                name="whatsappNumber"
                type="tel"
                autoComplete="tel"
                placeholder="Same as M-Pesa"
                value={buyerInfo.whatsappNumber}
                onChange={(e) => setBuyerInfo(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                className={`!pl-12 h-11 text-sm rounded-xl ${themeClasses.input}`}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* City and Area Selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* City Selection */}
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
                City
              </Label>
              <Select
                value={buyerInfo.city || 'Nairobi'}
                onValueChange={(value) => {
                  setBuyerInfo(prev => ({
                    ...prev,
                    city: value,
                    location: ''
                  }));
                }}
                disabled={isLoading}
              >
                <SelectTrigger className={`h-11 text-sm rounded-xl ${themeClasses.input}`}>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent className={`${themeClasses.bg} ${themeClasses.text} border-slate-200 dark:border-white/15`}>
                  {Object.keys(locationData).map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Area Selection */}
            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.label}`}>
                Area / Neighborhood
              </Label>
              <Select
                value={buyerInfo.location}
                onValueChange={(value) => setBuyerInfo(prev => ({ ...prev, location: value }))}
                disabled={isLoading}
              >
                <SelectTrigger className={`h-11 text-sm rounded-xl ${themeClasses.input}`}>
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent className={`${themeClasses.bg} ${themeClasses.text} border-slate-200 dark:border-white/15`}>
                  {(locationData[buyerInfo.city || 'Nairobi'] || locationData['Nairobi']).map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Terms and Conditions Checkout */}
        <div className="flex items-start gap-3 mt-4 px-1">
          <input
            type="checkbox"
            id="termsAccepted"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-200 bg-slate-50 text-yellow-400 focus:ring-yellow-400 accent-yellow-400"
          />
          <label htmlFor="termsAccepted" className={`text-sm cursor-pointer leading-relaxed ${themeClasses.label}`}>
            I agree to the{' '}
            <button
              type="button"
              onClick={() => setIsTermsModalOpen(true)}
              className="underline font-medium hover:text-yellow-500 transition-colors"
            >
              Terms and Conditions
            </button>
            {' '}and have read the Privacy Policy.
          </label>
        </div>
        {errors.termsAccepted && (
          <p className={`text-[10px] font-bold px-1 ${themeClasses.error}`}>{errors.termsAccepted}</p>
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-8 pt-4 space-y-3 mt-auto border-t border-slate-200 dark:border-white/15 shrink-0 bg-slate-50 dark:bg-white/5 backdrop-blur-sm">
        <Button
          type="submit"
          disabled={isLoading || !termsAccepted}
          className={`w-full h-12 rounded-xl font-semibold text-base shadow-lg transition-all bg-yellow-400 hover:bg-yellow-500 text-black active:scale-[0.98] ${
            !termsAccepted ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Initiating Payment...
            </>
          ) : (
            'Continue to Payment'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleClose}
          disabled={isLoading}
          className="w-full h-10 text-sm font-bold text-slate-700 dark:text-white hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default BuyerInfoForm;
