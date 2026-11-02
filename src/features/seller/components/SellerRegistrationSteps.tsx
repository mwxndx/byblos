import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Store, Globe, Check, X, Eye, EyeOff, UploadCloud, Trash2, ImagePlus } from '@/shared/ui/icons';
import { useToast } from '@/shared/hooks/use-toast';
import ShopLocationPicker from '@/shared/components/ShopLocationPicker';
import { checkPasswordStrength, locationData, type SellerRegistrationFormData } from '../utils/sellerRegistrationUtils';

interface SellerRegistrationStepsProps {
  currentStep: number;
  formData: SellerRegistrationFormData;
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setFormData: Dispatch<SetStateAction<SellerRegistrationFormData>>;
  shopNameAvailable: boolean | null;
  isCheckingShopName: boolean;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  showConfirmPassword: boolean;
  setShowConfirmPassword: Dispatch<SetStateAction<boolean>>;
  passwordError: string;
  hasPhysicalShop: boolean | null;
  setHasPhysicalShop: Dispatch<SetStateAction<boolean | null>>;
  setCurrentStep: Dispatch<SetStateAction<number>>;
  termsAccepted: boolean;
  setTermsAccepted: Dispatch<SetStateAction<boolean>>;
  setIsTermsModalOpen: Dispatch<SetStateAction<boolean>>;
  isExistingUser: boolean;
}

export const SellerRegistrationSteps = ({
  currentStep,
  formData,
  handleInputChange,
  setFormData,
  shopNameAvailable,
  isCheckingShopName,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordError,
  hasPhysicalShop,
  setHasPhysicalShop,
  setCurrentStep,
  termsAccepted,
  setTermsAccepted,
  setIsTermsModalOpen,
  isExistingUser,
}: SellerRegistrationStepsProps) => {
  const { toast } = useToast();

  const handlePhotoSelect = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (PNG, JPG, WEBP).',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Image size should be less than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setFormData(prev => ({ ...prev, businessPhoto: base64 }));
    };
    reader.onerror = () => {
      toast({
        title: 'Upload Failed',
        description: 'Failed to read image file. Please try another.',
        variant: 'destructive',
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Step 1: Shop & Contact */}
      {currentStep === 1 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-0.5 sm:space-y-2">
              <Label htmlFor="firstName" className="text-[10px] sm:text-sm font-medium text-gray-200">
                First Name
              </Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
              />
            </div>

            <div className="space-y-0.5 sm:space-y-2">
              <Label htmlFor="lastName" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                Last Name
              </Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
              />
            </div>
          </div>

          <div className="space-y-0.5 sm:space-y-2">
            <Label htmlFor="shopName" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              Shop Name
              {formData.shopName.length >= 3 && (
                <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${shopNameAvailable ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {isCheckingShopName ? 'Checking...' : shopNameAvailable ? 'Available' : 'Taken'}
                </span>
              )}
            </Label>
            <Input
              id="shopName"
              name="shopName"
              type="text"
              placeholder="Unique shop name"
              value={formData.shopName}
              onChange={handleInputChange}
              required
              className={`input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base ${shopNameAvailable === false ? 'border-red-500' : ''}`}
            />
            <p className="text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400">byblosafrica.site/{formData.shopName ? formData.shopName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') : 'yourshop'}</p>
          </div>

          <div className="space-y-0.5 sm:space-y-2">
            <Label htmlFor="email" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Email Address</span>
              {isExistingUser && (
                <span className="text-[9px] sm:text-xs text-yellow-600 dark:text-yellow-400 font-semibold">Linked to Byblos account</span>
              )}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Your email address"
              value={formData.email}
              onChange={handleInputChange}
              readOnly={isExistingUser}
              required
              className={`input-mobile !pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base ${isExistingUser ? 'opacity-80 cursor-not-allowed' : ''}`}
            />
          </div>

        </>
      )}

      {/* Step 2: Location */}
      {currentStep === 2 && (
        <>
          <div className="space-y-0.5 sm:space-y-2">
            <Label className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">City</Label>
            <Select
              value={formData.city}
              onValueChange={(value) => setFormData(prev => ({ ...prev, city: value, location: '' }))}
            >
              <SelectTrigger className="!pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-white dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white focus:border-white focus:ring-white text-[10px] sm:text-base">
                <SelectValue placeholder="Nairobi" className="text-slate-400 dark:text-slate-400" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                <SelectItem value="Nairobi" className="text-slate-900 dark:text-white focus:bg-gray-100 focus:text-black dark:focus:bg-white/10 dark:focus:text-white text-xs">
                  Nairobi
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-0.5 sm:space-y-2">
            <Label className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">Area/Location</Label>
            <Select
              value={formData.location}
              onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
              disabled={!formData.city}
            >
              <SelectTrigger className="!pl-4 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-white dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white focus:border-white focus:ring-white disabled:opacity-50 text-[10px] sm:text-base">
                <SelectValue placeholder={formData.city ? 'Select your area' : 'Select city first'} className="text-slate-400 dark:text-slate-400" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                {formData.city && locationData[formData.city]?.sort((a, b) => a.localeCompare(b)).map((area) => (
                  <SelectItem key={area} value={area} className="text-slate-900 dark:text-white focus:bg-gray-100 focus:text-black dark:focus:bg-white/10 dark:focus:text-white text-xs">{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Step 3: Shop Details */}
      {currentStep === 3 && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {hasPhysicalShop === null ? (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Do you have a physical shop?</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                  Adding your shop location helps local customers find you easily.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Button
                  type="button"
                  onClick={() => {
                    setHasPhysicalShop(false);
                    setFormData(prev => ({ ...prev, physicalAddress: '', latitude: undefined, longitude: undefined }));
                    setCurrentStep(4); // Move directly to verification
                  }}
                  variant="ghost"
                  className="min-h-[100px] h-auto flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all group active:scale-95 border border-slate-200 dark:border-separator hover:bg-slate-100 dark:hover:bg-fill uppercase tracking-wider bg-slate-50 dark:bg-fill text-center"
                >
                  <div className="flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Globe className="h-8 w-8 text-slate-500 dark:text-zinc-400 group-hover:text-slate-950 dark:group-hover:text-white" />
                  </div>
                  <span className="font-bold text-[10px] sm:text-xs text-slate-600 dark:text-label-2 group-hover:text-slate-950 dark:group-hover:text-white transition-colors leading-tight break-words">
                    Online Only
                  </span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setHasPhysicalShop(true)}
                  variant="ghost"
                  className="min-h-[100px] h-auto flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all group active:scale-95 border border-slate-200 dark:border-separator hover:bg-slate-100 dark:hover:bg-fill uppercase tracking-wider bg-slate-50 dark:bg-fill text-center"
                >
                  <div className="flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Store className="h-8 w-8 text-slate-800 dark:text-white" />
                  </div>
                  <span className="font-bold text-[10px] sm:text-xs text-slate-600 dark:text-label-2 group-hover:text-slate-950 dark:group-hover:text-white transition-colors leading-tight break-words">
                    Have a Shop
                  </span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in zoom-in-95 duration-300">
              {hasPhysicalShop && (
                <ShopLocationPicker
                  initialAddress={formData.physicalAddress}
                  initialCoordinates={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                  onLocationChange={(address, coords) => {
                    setFormData(prev => ({
                      ...prev,
                      physicalAddress: address,
                      latitude: coords?.lat,
                      longitude: coords?.lng
                    }));
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Business Profile Photo */}
      {currentStep === 4 && (
        <div className="space-y-4 text-center animate-in fade-in-50 duration-200">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              Business Profile Photo
            </h3>
            <p className="text-xs text-slate-600 dark:text-white/60 max-w-sm mx-auto leading-relaxed">
              Add a business photo or shop logo. This helps buyers recognize and trust your shop.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center pt-2">
            {formData.businessPhoto ? (
              <div className="space-y-3 flex flex-col items-center">
                <div className="relative group">
                  <img
                    src={formData.businessPhoto}
                    alt="Business Profile Preview"
                    className="h-28 w-28 rounded-full object-cover border-4 border-yellow-400 shadow-md transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <ImagePlus className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="businessPhotoChange"
                    className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-fill hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white transition flex items-center gap-1.5"
                  >
                    <ImagePlus className="h-3.5 w-3.5 text-yellow-500" />
                    <span>Change Photo</span>
                    <input
                      id="businessPhotoChange"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handlePhotoSelect(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, businessPhoto: '' }))}
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 px-2.5 rounded-xl"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="businessPhotoUpload"
                className="flex flex-col items-center justify-center h-32 w-32 rounded-full border-2 border-dashed border-yellow-500/60 dark:border-yellow-400/60 bg-yellow-500/5 hover:bg-yellow-500/10 cursor-pointer transition group p-4 shadow-sm"
              >
                <div className="p-2.5 rounded-full bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 mb-1 group-hover:scale-110 transition-transform">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center leading-tight">
                  Upload Photo
                </span>
                <span className="text-[9px] text-slate-500 dark:text-white/50">Required</span>
                <input
                  id="businessPhotoUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handlePhotoSelect(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          <div className="bg-slate-100 dark:bg-fill p-2.5 rounded-xl border border-slate-200 dark:border-separator text-left max-w-sm mx-auto">
            <p className="text-[11px] font-medium text-slate-700 dark:text-white/80">
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">Notice: </span>
              A business photo is required before creating your seller account. It will be displayed on your storefront and product listings.
            </p>
            <p className="text-[10px] text-slate-500 dark:text-white/50 mt-1">
              Formats: JPG, PNG, WEBP &bull; Max size: 5MB
            </p>
          </div>
        </div>
      )}

      {/* Step 5: Security */}
      {currentStep === 5 && (
        <>
          {isExistingUser && (
            <p className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 font-medium bg-yellow-400/10 dark:bg-yellow-400/15 p-2 rounded-lg border border-yellow-400/30">
              Enter your existing Byblos account password to link your seller profile.
            </p>
          )}
          <div className="space-y-0.5 sm:space-y-2">
            <Label htmlFor="password" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="input-mobile !pl-4 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                ) : (
                  <Eye className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Password Strength Checklist */}
          {formData.password && (
            <div className="mt-2 p-3 bg-slate-100 dark:bg-fill rounded-xl border border-slate-200 dark:border-separator">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Password Requirements:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "8+ chars", met: checkPasswordStrength(formData.password).minLength },
                  { label: "1 Number", met: checkPasswordStrength(formData.password).hasNumber },
                  { label: "1 Special", met: checkPasswordStrength(formData.password).hasSpecial },
                  { label: "Upper/Lower", met: checkPasswordStrength(formData.password).hasUpper && checkPasswordStrength(formData.password).hasLower },
                ].map((req) => (
                  <div key={req.label} className="flex items-center space-x-2">
                    {req.met ? (
                      <div className="bg-green-500/20 p-0.5 rounded-full">
                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 dark:text-green-400" />
                      </div>
                    ) : (
                      <div className="bg-slate-300 dark:bg-gray-700 p-0.5 rounded-full">
                        <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-600 dark:text-label-2" />
                      </div>
                    )}
                    <span className={`text-[10px] sm:text-xs ${req.met ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-slate-600 dark:text-label-2'}`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-0.5 sm:space-y-2">
            <Label htmlFor="confirmPassword" className="text-[10px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="input-mobile !pl-4 !pr-8 sm:!pr-12 h-8 sm:h-12 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-fill border-slate-300 dark:border-white/15 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400 text-[10px] sm:text-base"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-2 sm:pr-4 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                ) : (
                  <Eye className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="text-[10px] sm:text-sm text-red-500 dark:text-red-400 font-semibold">{passwordError}</p>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-start space-x-2 bg-gray-900/40 p-3 rounded-xl border border-gray-800">
              <input
                type="checkbox"
                id="termsAccepted"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-800 text-yellow-500 focus:ring-yellow-500"
              />
              <Label htmlFor="termsAccepted" className="text-xs text-label-2 leading-tight">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="text-yellow-400 hover:text-yellow-300 font-medium underline underline-offset-2"
                >
                  Terms & Conditions
                </button>
                {' '}and have read the Privacy Policy.
              </Label>
            </div>
          </div>
        </>
      )}
    </>
  );
};
