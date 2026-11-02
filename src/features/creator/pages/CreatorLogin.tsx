import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from '@/shared/ui/icons';
import { useGlobalAuth } from '@/features/auth/contexts';
import { getFreshCsrfToken } from '@/infrastructure/http/apiClient';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { VerifyEmailModal } from '@/features/auth/components/VerifyEmailModal';
import TermsModal from '@/shared/components/TermsModal';
import { toast } from 'sonner';
import { getLoginPath } from '@/features/auth/utils/authRouting';
import type { UserRole } from '@/features/auth/types/authTypes';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';

export default function CreatorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);

  const { login } = useGlobalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void getFreshCsrfToken();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const emailEntry = formData.get('email');
    const passwordEntry = formData.get('password');
    const targetEmail = (typeof emailEntry === 'string' ? emailEntry.trim() : '') || email.trim();
    const targetPassword = (typeof passwordEntry === 'string' ? passwordEntry.trim() : '') || password.trim();

    if (!targetEmail || !targetPassword) {
      return;
    }

    setLoading(true);
    try {
      await login(targetEmail, targetPassword, 'creator');
      // Navigation is handled by useGlobalAuth().login() via getDashboardPath('creator')
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
        const correctRole = (classified.userType || (classified.message.includes('seller') ? 'seller' : classified.message.includes('buyer') ? 'buyer' : 'seller')) as UserRole;
        toast.error('Wrong Portal', {
          id: 'creator-wrong-portal',
          description: classified.message,
          action: {
            label: `Go to ${correctRole.charAt(0).toUpperCase() + correctRole.slice(1)} Login`,
            onClick: () => navigate(getLoginPath(correctRole)),
          },
          duration: 8000,
        });
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    setIsTermsModalOpen(false);
    if (!pendingCredentials) return;
    setLoading(true);
    try {
      await login(pendingCredentials.email, pendingCredentials.password, 'creator', true);
    } catch (error: unknown) {
      const classified = classifyApiError(error);
      toast.error('Login Failed', { description: classified.message });
    } finally {
      setLoading(false);
      setPendingCredentials(null);
    }
  };

  return (
    <PenpotAuthLayout
      roleTag="CREATOR PORTAL"
      title="Welcome back."
      subtitle="Sign in to see your referrals and earnings."
      footerLead="New to Byblos?"
      footerLinkText="Create account"
      footerLinkTo="/creator/register"
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
            aria-label="Email"
            required
            disabled={loading}
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
              aria-label="Password"
              required
              disabled={loading}
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] pl-4 pr-12 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#8a8a91] hover:text-white transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Forgot Password Row */}
        <div className="flex justify-end pt-0.5">
          <Link
            to="/creator/forgot-password"
            className="text-[13px] text-[#a1a1a6] hover:text-white transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          aria-label="Sign In"
          className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm mt-2 disabled:opacity-60 cursor-pointer"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log in'}
        </button>
      </form>

      <VerifyEmailModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        email={unverifiedEmail}
        role="creator"
      />

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => {
          setIsTermsModalOpen(false);
          setPendingCredentials(null);
        }}
        onAccept={handleAcceptTerms}
      />
    </PenpotAuthLayout>
  );
}
