import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Eye, EyeOff, Globe, Store } from '@/shared/ui/icons';
import ShopLocationPicker from '@/shared/components/ShopLocationPicker';
import { locationData, type SellerRegistrationFormData } from '../utils/sellerRegistrationUtils';
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist';

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
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Step 1: Shop & Contact */}
      {currentStep === 1 && (
        <>
          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-[13px] font-medium text-[#a1a1a6]">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="Amina"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-[13px] font-medium text-[#a1a1a6]">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Wanjiru"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <label htmlFor="shopName" className="text-[13px] font-medium text-[#a1a1a6]">
                Shop name
              </label>
              {formData.shopName.length >= 3 && (
                <span
                  className={`text-[11px] font-semibold tracking-wider ${
                    isCheckingShopName
                      ? 'text-[#a1a1a6]'
                      : shopNameAvailable
                      ? 'text-[#30d158]'
                      : 'text-[#ff453a]'
                  }`}
                >
                  {isCheckingShopName ? 'Checking...' : shopNameAvailable ? 'Available' : 'Taken'}
                </span>
              )}
            </div>
            <input
              id="shopName"
              name="shopName"
              type="text"
              placeholder="Unique shop name"
              value={formData.shopName}
              onChange={handleInputChange}
              required
              className={`h-14 w-full bg-[#27272c] border ${
                shopNameAvailable === false ? 'border-red-500' : 'border-[#34343a]'
              } focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors`}
            />
            <p className="text-[11px] text-[#8a8a91]">
              byblosafrica.site/{formData.shopName.toLowerCase() || 'yourshop'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <label htmlFor="email" className="text-[13px] font-medium text-[#a1a1a6]">
                Email address
              </label>
              {isExistingUser && (
                <span className="text-[11px] text-[#f5c518] font-semibold">Linked to Byblos account</span>
              )}
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleInputChange}
              readOnly={isExistingUser}
              required
              className={`h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors ${
                isExistingUser ? 'opacity-80 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </>
      )}

      {/* Step 2: Location */}
      {currentStep === 2 && (
        <>
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="city" className="text-[13px] font-medium text-[#a1a1a6]">
              City
            </label>
            <select
              id="city"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value, location: '' }))}
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] transition-colors appearance-none cursor-pointer"
            >
              <option value="Nairobi" className="bg-[#27272c] text-white">Nairobi</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="location" className="text-[13px] font-medium text-[#a1a1a6]">
              Area / location
            </label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              disabled={!formData.city}
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] transition-colors appearance-none cursor-pointer"
            >
              <option value="" disabled className="bg-[#27272c] text-[#8a8a91]">
                Select your area
              </option>
              {formData.city &&
                locationData[formData.city]?.sort((a, b) => a.localeCompare(b)).map((area) => (
                  <option key={area} value={area} className="bg-[#27272c] text-white">
                    {area}
                  </option>
                ))}
            </select>
          </div>
        </>
      )}

      {/* Step 3: Shop Type / Location */}
      {currentStep === 3 && (
        <div className="w-full flex flex-col gap-4">
          {hasPhysicalShop === null ? (
            <div className="grid grid-cols-2 gap-3 w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  setHasPhysicalShop(false);
                  setFormData((prev) => ({
                    ...prev,
                    physicalAddress: '',
                    latitude: undefined,
                    longitude: undefined,
                  }));
                  setCurrentStep(4);
                }}
                className="h-32 rounded-[14.5px] bg-[#27272c] border border-[#34343a] hover:border-[#f5c518] p-4 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Globe className="w-8 h-8 text-[#a1a1a6]" />
                <span className="text-[14px] font-semibold text-white">Online only</span>
              </button>

              <button
                type="button"
                onClick={() => setHasPhysicalShop(true)}
                className="h-32 rounded-[14.5px] bg-[#27272c] border border-[#34343a] hover:border-[#f5c518] p-4 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Store className="w-8 h-8 text-[#f5c518]" />
                <span className="text-[14px] font-semibold text-white">Physical shop</span>
              </button>
            </div>
          ) : (
            <div className="w-full">
              {hasPhysicalShop && (
                <ShopLocationPicker
                  initialAddress={formData.physicalAddress}
                  initialCoordinates={
                    formData.latitude && formData.longitude
                      ? { lat: formData.latitude, lng: formData.longitude }
                      : null
                  }
                  onLocationChange={(address, coords) => {
                    setFormData((prev) => ({
                      ...prev,
                      physicalAddress: address,
                      latitude: coords?.lat,
                      longitude: coords?.lng,
                    }));
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Password */}
      {currentStep === 4 && (
        <>
          {isExistingUser && (
            <p className="text-xs text-[#f5c518] font-medium bg-[#f5c518]/10 p-3 rounded-xl border border-[#f5c518]/30">
              Enter your existing Byblos account password to link your seller profile.
            </p>
          )}

          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="password" className="text-[13px] font-medium text-[#a1a1a6]">
              Password
            </label>
            <div className="relative w-full">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] pl-4 pr-12 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#8a8a91] hover:text-white transition-colors"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#a1a1a6]">
              Confirm password
            </label>
            <div className="relative w-full">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] pl-4 pr-12 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#8a8a91] hover:text-white transition-colors"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-red-400 mt-0.5">{passwordError}</p>}
          </div>

          <PasswordChecklist
            password={formData.password}
            confirmPassword={formData.confirmPassword}
            title="PASSWORD REQUIREMENTS"
            showMatch={false}
          />

          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="termsAccepted"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-4 h-4 rounded border-[#34343a] bg-[#27272c] text-[#f5c518] focus:ring-[#f5c518] accent-[#f5c518] cursor-pointer"
            />
            <label htmlFor="termsAccepted" className="text-[13px] text-[#a1a1a6] cursor-pointer">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="text-[#f5c518] hover:underline font-medium"
              >
                Terms and Privacy Policy
              </button>
            </label>
          </div>
        </>
      )}
    </div>
  );
};
export default SellerRegistrationSteps;
