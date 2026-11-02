import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, RefreshCw } from '@/shared/ui/icons';
import { useToast } from '@/shared/hooks/use-toast';
import TermsModal from '@/shared/components/TermsModal';
import { SellerRegistrationSteps } from '../components/SellerRegistrationSteps';
import { useSellerRegistration } from '../hooks/useSellerRegistration';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';
import { AuthProgressBar } from '@/features/auth/components/AuthProgressBar';

interface SellerRegistrationProps {
  onSuccess?: () => void;
}

const SellerRegistration = ({ onSuccess }: SellerRegistrationProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    formData,
    setFormData,
    handleInputChange,
    handleSubmit,
    isLoading,
    isCheckingShopName,
    shopNameAvailable,
    passwordError,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    currentStep,
    setCurrentStep,
    hasPhysicalShop,
    setHasPhysicalShop,
    isRegistered,
    termsAccepted,
    setTermsAccepted,
    isTermsModalOpen,
    setIsTermsModalOpen,
    resendCooldown,
    isResending,
    handleResend,
    isExistingUser,
  } = useSellerRegistration(onSuccess);

  const handleBack = () => {
    if (currentStep === 4) {
      setCurrentStep(3);
      setHasPhysicalShop(null);
      setFormData((prev) => ({
        ...prev,
        physicalAddress: '',
        latitude: undefined,
        longitude: undefined,
      }));
    } else if (currentStep === 3 && hasPhysicalShop !== null) {
      setHasPhysicalShop(null);
      setFormData((prev) => ({
        ...prev,
        physicalAddress: '',
        latitude: undefined,
        longitude: undefined,
      }));
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };

  const getTitle = () => {
    if (currentStep === 3) {
      return hasPhysicalShop ? 'Where is your shop?' : 'Do you have a physical shop?';
    }
    return 'Create account';
  };

  const getSubtitle = () => {
    switch (currentStep) {
      case 1:
        return 'Name your shop and add your contact details.';
      case 2:
        return 'Where are you based?';
      case 3:
        return hasPhysicalShop
          ? 'Add an address or drop a pin so customers can find you.'
          : 'Adding your shop location helps local customers find you easily.';
      case 4:
        return 'Secure your account.';
      default:
        return 'Name your shop and add your contact details.';
    }
  };

  if (isRegistered) {
    return (
      <PenpotAuthLayout
        roleTag="SELLER PORTAL"
        title="Check your email"
        subtitle="One more step to launch your shop"
        showTrustLine={true}
        showBackButton={true}
        onBack={() => navigate('/seller/login')}
      >
        <div className="w-full flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 flex items-center justify-center text-[#f5c518]">
            <Mail className="w-8 h-8" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Check your email</h3>
            <p className="text-[14px] text-[#a1a1a6] leading-relaxed max-w-[320px] mx-auto">
              We've sent a verification link to <span className="text-white font-medium underline">{formData.email}</span>.
              Please click the link to activate your shop.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/seller/login')}
              className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm cursor-pointer"
            >
              Go to Login
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className="h-12 w-full rounded-[14.5px] border border-[#34343a] bg-transparent text-[14px] text-[#a1a1a6] hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isResending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend"}
            </button>
            <p className="text-[11px] text-[#8a8a91] text-center">Also check your spam / junk folder.</p>
          </div>
        </div>
      </PenpotAuthLayout>
    );
  }

  return (
    <PenpotAuthLayout
      roleTag="SELLER PORTAL"
      title={getTitle()}
      subtitle={getSubtitle()}
      footerLead="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/seller/login"
      showBackButton={true}
      onBack={handleBack}
    >
      <div className="w-full flex flex-col">
        {/* Segmented Progress Bar */}
        <AuthProgressBar currentStep={currentStep} totalSteps={4} />

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <SellerRegistrationSteps
            currentStep={currentStep}
            formData={formData}
            handleInputChange={handleInputChange}
            setFormData={setFormData}
            shopNameAvailable={shopNameAvailable}
            isCheckingShopName={isCheckingShopName}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            passwordError={passwordError}
            hasPhysicalShop={hasPhysicalShop}
            setHasPhysicalShop={setHasPhysicalShop}
            setCurrentStep={setCurrentStep}
            termsAccepted={termsAccepted}
            setTermsAccepted={setTermsAccepted}
            setIsTermsModalOpen={setIsTermsModalOpen}
            isExistingUser={isExistingUser}
          />

          {/* Action buttons */}
          <div className="pt-2 w-full">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!formData.firstName || !formData.lastName || !formData.shopName || !formData.email) {
                    toast({
                      title: 'Missing Information',
                      description: 'Please fill in all details',
                      variant: 'destructive',
                    });
                    return;
                  }
                  if (shopNameAvailable === false) {
                    toast({
                      title: 'Shop Name Unavailable',
                      description: 'Please choose another name',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm cursor-pointer"
              >
                Next
              </button>
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-14 flex-1 rounded-[14.5px] border border-[#34343a] text-white hover:bg-white/10 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] cursor-pointer"
                >
                  Back
                </button>
                {currentStep === 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.city || !formData.location) {
                        toast({
                          title: 'Missing Information',
                          description: 'Please select your location',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setCurrentStep(3);
                    }}
                    className="btn-white h-14 flex-1 rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm cursor-pointer"
                  >
                    Next
                  </button>
                ) : currentStep === 3 && hasPhysicalShop !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      const hasShopLocation = Boolean(
                        formData.physicalAddress || (formData.latitude && formData.longitude)
                      );
                      if (hasPhysicalShop && !hasShopLocation) {
                        toast({
                          title: 'Shop Address Required',
                          description: 'Please provide a specific shop address or location on the map.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      if (
                        hasPhysicalShop &&
                        !formData.physicalAddress &&
                        formData.latitude &&
                        formData.longitude
                      ) {
                        setFormData((prev) => ({
                          ...prev,
                          physicalAddress: prev.location
                            ? `${prev.location} (Pinned on map)`
                            : 'Pinned on map',
                        }));
                      }
                      setCurrentStep(4);
                    }}
                    className="btn-white h-14 flex-1 rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm cursor-pointer"
                  >
                    Next
                  </button>
                ) : currentStep === 4 ? (
                  <button
                    type="submit"
                    disabled={isLoading || !termsAccepted}
                    className="btn-white h-14 flex-1 rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Register'
                    )}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </form>
      </div>

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={() => setTermsAccepted(true)}
      />
    </PenpotAuthLayout>
  );
};

export default SellerRegistration;
