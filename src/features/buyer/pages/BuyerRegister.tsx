import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/shared/hooks/use-toast';
import { Loader2, Mail, RefreshCw } from '@/shared/ui/icons';
import TermsModal from '@/shared/components/TermsModal';
import { BuyerRegisterSteps } from '@/features/buyer/components/BuyerRegisterSteps';
import { useBuyerRegister } from '@/features/buyer/hooks/useBuyerRegister';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';
import { AuthProgressBar } from '@/features/auth/components/AuthProgressBar';

export function BuyerRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    formData,
    setFormData,
    handleInputChange,
    handleSubmit,
    errors,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    currentStep,
    setCurrentStep,
    isRegistered,
    termsAccepted,
    setTermsAccepted,
    isTermsModalOpen,
    setIsTermsModalOpen,
    resendCooldown,
    isResending,
    handleResend,
    isLoading,
    isExistingUser,
  } = useBuyerRegister();

  const getSubtitle = () => {
    switch (currentStep) {
      case 1:
        return 'Tell us a little about you.';
      case 2:
        return 'Where are you based?';
      case 3:
        return 'Secure your account.';
      default:
        return 'Tell us a little about you.';
    }
  };

  if (isRegistered) {
    return (
      <PenpotAuthLayout
        roleTag="BUYER PORTAL"
        title="Verification sent"
        subtitle="One more step to join us"
        showTrustLine={true}
        showBackButton={true}
        onBack={() => navigate('/buyer/login')}
      >
        <div className="w-full flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 flex items-center justify-center text-[#f5c518]">
            <Mail className="w-8 h-8" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Check your email</h3>
            <p className="text-[14px] text-[#a1a1a6] leading-relaxed max-w-[320px] mx-auto">
              We've sent a verification link to <span className="text-white font-medium underline">{formData.email}</span>.
              Please click the link to activate your account.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Link
              to="/buyer/login"
              className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm"
            >
              Go to Login
            </Link>

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
      roleTag="BUYER PORTAL"
      title="Create account"
      subtitle={getSubtitle()}
      footerLead="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/buyer/login"
      showBackButton={true}
      onBack={() => {
        if (currentStep > 1) {
          setCurrentStep(currentStep - 1);
        } else {
          navigate('/');
        }
      }}
    >
      <div className="w-full flex flex-col">
        {/* Progress bar */}
        <AuthProgressBar currentStep={currentStep} totalSteps={3} />

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <BuyerRegisterSteps
            currentStep={currentStep}
            formData={formData}
            handleInputChange={handleInputChange}
            setFormData={setFormData}
            errors={errors}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
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
                  if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobilePayment) {
                    toast({
                      title: 'Missing Information',
                      description: 'Please fill in all personal details',
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
            ) : currentStep === 2 ? (
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="h-14 w-full rounded-[14.5px] border border-[#34343a] text-white hover:bg-white/10 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.city || !formData.location) {
                      toast({
                        title: 'Missing Information',
                        description: 'Please select your city and area',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setCurrentStep(3);
                  }}
                  className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm cursor-pointer"
                >
                  Next
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="h-14 w-full rounded-[14.5px] border border-[#34343a] text-white hover:bg-white/10 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !termsAccepted}
                  className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
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
}

export default BuyerRegister;
