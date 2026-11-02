import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from '@/shared/ui/icons';
import { useGlobalAuth } from '@/features/auth/contexts';
import { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { VerifyEmailModal } from '@/features/auth/components/VerifyEmailModal';
import TermsModal from '@/shared/components/TermsModal';
import { SellerForgotPasswordDialog } from '../components/SellerForgotPasswordDialog';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { getLoginPath } from '@/features/auth/utils/authRouting';
import type { UserRole } from '@/features/auth/types/authTypes';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';

export function SellerLogin() {
  const navigate = useNavigate();
  const { login, forgotPassword } = useGlobalAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const loginInFlightRef = useRef(false);

  useEffect(() => {
    void getFreshCsrfToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInFlightRef.current) return;

    let targetEmail = email?.trim().toLowerCase();
    let targetPassword = password?.trim();

    if (!targetEmail) {
      const emailEl = document.querySelector<HTMLInputElement>('input[name="email"], input[type="email"]');
      if (emailEl?.value) targetEmail = emailEl.value.trim().toLowerCase();
    }
    if (!targetPassword) {
      const passEl = document.querySelector<HTMLInputElement>('input[name="password"], input[type="password"]');
      if (passEl?.value) targetPassword = passEl.value;
    }

    if (!targetEmail || !targetPassword) {
      toast.error('Please enter both your email address and password.');
      return;
    }

    loginInFlightRef.current = true;
    setIsLoading(true);
    try {
      await login(targetEmail, targetPassword, 'seller');
      // Navigation handled by useGlobalAuth().login() via getDashboardPath('seller')
    } catch (error: unknown) {
      const classified = classifyApiError(error);
      if (classified.code === 'PENDING_VERIFICATION' || classified.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(classified.email || targetEmail);
        setIsVerifyModalOpen(true);
        return;
      }
      if (classified.code === 'TERMS_NOT_ACCEPTED') {
        setPendingCredentials({ email: targetEmail, password: targetPassword });
        setIsTermsModalOpen(true);
        return;
      }
      if (classified.code === 'WRONG_PORTAL') {
        const correctRole = (classified.userType || (classified.message.includes('buyer') ? 'buyer' : classified.message.includes('creator') ? 'creator' : 'buyer')) as UserRole;
        toast.error('Wrong Portal', {
          id: 'seller-wrong-portal',
          description: classified.message,
          action: {
            label: `Go to ${correctRole.charAt(0).toUpperCase() + correctRole.slice(1)} Login`,
            onClick: () => navigate(getLoginPath(correctRole)),
          },
          duration: 8000,
        });
        return;
      }
      // Error toast handled inside useAuthActions
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    setIsTermsModalOpen(false);
    if (!pendingCredentials) return;
    if (loginInFlightRef.current) return;
    loginInFlightRef.current = true;
    setIsLoading(true);
    try {
      await login(pendingCredentials.email, pendingCredentials.password, 'seller', true);
    } catch (error: unknown) {
      const classified = classifyApiError(error);
      toast.error('Login Failed', { description: classified.message });
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
      setPendingCredentials(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setIsSendingResetLink(true);
    try {
      const success = await forgotPassword(forgotPasswordEmail, 'seller');
      if (success) {
        toast.success('Reset link sent', { description: 'If an account exists with this email, you will receive a password reset link.' });
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      } else {
        toast.error('Failed to send reset link. Please try again later.');
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to send reset link. Please try again later.');
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <PenpotAuthLayout
      roleTag="SELLER PORTAL"
      title="Welcome back."
      subtitle="Sign in to manage your shop and orders."
      footerLead="New to Byblos?"
      footerLinkText="Create account"
      footerLinkTo="/seller/register"
      showBackButton={true}
      onBack={() => navigate('/')}
    >
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        {/* Email Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="email" className="text-[13px] font-medium text-[#a1a1a6]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={isLoading}
            className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
          />
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="password" className="text-[13px] font-medium text-[#a1a1a6]">
            Password
          </label>
          <div className="relative w-full">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={isLoading}
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] pl-4 pr-12 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#8a8a91] hover:text-white transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Forgot Password Row */}
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-[13px] text-[#a1a1a6] hover:text-white transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={isLoading}
          aria-label="Sign In"
          className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm mt-2 disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log in'}
        </button>
      </form>

      <VerifyEmailModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        email={unverifiedEmail}
        role="seller"
      />

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => {
          setIsTermsModalOpen(false);
          setPendingCredentials(null);
        }}
        onAccept={handleAcceptTerms}
      />

      <SellerForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        email={forgotPasswordEmail}
        onEmailChange={setForgotPasswordEmail}
        onSubmit={handleForgotPassword}
        isSending={isSendingResetLink}
      />
    </PenpotAuthLayout>
  );
}

export default SellerLogin;
