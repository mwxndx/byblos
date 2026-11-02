import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { useCreatorRegisterMutation } from '@/features/creator/hooks/mutations/useCreatorAuthMutations';
import { useCreatorInviteQuery } from '@/features/creator/hooks/queries/useCreatorInviteQuery';
import { Button } from '@/shared/ui/button';
import { useModalBackDismiss } from '@/shared/hooks/useModalBackDismiss';
import TermsModal from '@/shared/components/TermsModal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist';

type CreatorInvite = {
  email?: string;
  shopName?: string;
};

type ApiError = {
  response?: { data?: { message?: string; code?: string; status?: string; data?: { hasBuyer?: boolean; hasSeller?: boolean; loginPath?: string; suggestedRole?: string } } };
  message?: string;
  code?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
};

export default function CreatorRegister() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user: authUser } = useGlobalAuth();
  const token = params.get('token') || '';
  const [invite, setInvite] = useState<CreatorInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingAccountPrompt, setExistingAccountPrompt] = useState(false);
  const [existingAccountInfo, setExistingAccountInfo] = useState<{
    hasBuyer?: boolean;
    hasSeller?: boolean;
    loginPath?: string;
    suggestedRole?: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mpesaNumber: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: ''
  });

  const { data: inviteData, error: inviteError, isLoading: inviteLoading } = useCreatorInviteQuery(token, Boolean(token));

  useEffect(() => {
    if (inviteData) {
      setInvite(inviteData);
      setForm((current) => ({ ...current, email: inviteData.email || '' }));
    }
  }, [inviteData]);

  // Pre-fill fields for an already logged-in user browsing to register as creator
  useEffect(() => {
    if (authUser && !token) {
      const userProfile = authUser.profile as unknown as Record<string, unknown>;
      const fullName = (userProfile?.fullName as string) || '';
      const nameParts = fullName.trim().split(/\s+/);
      const inferredFirst = nameParts[0] || (userProfile?.firstName as string) || '';
      const inferredLast = nameParts.slice(1).join(' ') || (userProfile?.lastName as string) || '';
      const inferredPhone = (userProfile?.whatsappNumber as string) || (userProfile?.phone as string) || (userProfile?.mobilePayment as string) || '';

      setForm((current) => ({
        ...current,
        email: current.email || authUser.profile?.email || '',
        firstName: current.firstName || inferredFirst,
        lastName: current.lastName || inferredLast,
        whatsappNumber: current.whatsappNumber || inferredPhone,
        mpesaNumber: current.mpesaNumber || inferredPhone
      }));
    }
  }, [authUser, token]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;
  const registerMutation = useCreatorRegisterMutation();

  useModalBackDismiss(existingAccountPrompt, () => setExistingAccountPrompt(false));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      toast.error('You must accept the Terms & Conditions to create an account.');
      return;
    }
    setLoading(true);
    try {
      const result = await registerMutation.mutateAsync({
        token: token || undefined,
        ...form,
        termsAccepted
      });
      const resObj = result as { status?: string; message?: string; data?: { status?: string; email?: string } };
      const registrationStatus = resObj?.data?.status;
      const responseMessage = resObj?.message;

      if (registrationStatus === 'created' || responseMessage?.includes('Creator access added')) {
        toast.success(responseMessage || 'Creator access added. You can now log in.');
        navigate('/creator/login');
        return;
      }

      toast.success(responseMessage || 'Account created. Check your email to verify it.');
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}&type=creator`);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const code = apiError?.response?.data?.code || apiError?.code;
      const errorMsg = getErrorMessage(error, 'Could not create creator account.');
      const rolesData = apiError?.response?.data?.data;

      if (code === 'EXISTING_ACCOUNT' || errorMsg.toLowerCase().includes('already has a byblos account')) {
        setExistingAccountInfo(rolesData || null);
        setExistingAccountPrompt(true);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // If a token was provided in the URL, validate it first
  if (token && inviteLoading) {
    return (
      <main className="min-h-screen bg-[#121214] text-white flex items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[#34343a] bg-[#27272c] px-5 py-3 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-[#f5c518]" />
          <span className="text-sm font-semibold text-white/80">Validating invite link...</span>
        </div>
      </main>
    );
  }

  // If a token was provided but failed validation, show the dedicated error screen
  if (token && inviteError) {
    const errorMsg = getErrorMessage(inviteError, 'This creator invite link is missing or has expired.');
    const isAlreadyUsed = errorMsg.toLowerCase().includes('already been used') || errorMsg.toLowerCase().includes('already used');
    return (
      <main className="min-h-screen bg-[#121214] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-3xl border border-[#34343a] bg-[#27272c] p-8 text-center space-y-4 shadow-2xl">
          <div className="text-4xl">{isAlreadyUsed ? '✅' : '🔗'}</div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {isAlreadyUsed ? 'Invite Already Used' : 'Invalid invite link'}
          </h1>
          <p className="text-sm text-[#a1a1a6] leading-relaxed">
            {isAlreadyUsed
              ? 'This creator invite has already been redeemed. If you have already created your account, please log in.'
              : 'This creator invite link is missing or has expired. Please ask the seller to resend your invite, then open the link from the email.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/creator/login')}
            className="btn-white inline-flex h-14 w-full items-center justify-center rounded-[14.5px] bg-white text-base font-semibold text-black hover:bg-white/90 shadow-sm transition"
          >
            Go to creator login
          </button>
        </div>
      </main>
    );
  }

  return (
    <PenpotAuthLayout
      roleTag="CREATOR PORTAL"
      title="Create account"
      subtitle={invite ? `${invite.shopName} invited you to sell through Byblos.` : 'Set up your creator account to start earning.'}
      footerLead="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/creator/login"
      showBackButton={true}
      onBack={() => navigate('/')}
    >
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3.5">
        {authUser && !token && (
          <p className="text-xs text-[#f5c518] font-medium bg-[#f5c518]/10 p-3 rounded-xl border border-[#f5c518]/30">
            Enter your existing Byblos account password to add creator access.
          </p>
        )}

        {/* First & Last Name row */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#a1a1a6]">
              First name
            </label>
            <input
              value={form.firstName}
              onChange={(e) => updateForm('firstName', e.target.value)}
              aria-label="First name"
              placeholder="Amina"
              required
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#a1a1a6]">
              Last name
            </label>
            <input
              value={form.lastName}
              onChange={(e) => updateForm('lastName', e.target.value)}
              aria-label="Last name"
              placeholder="Wanjiru"
              required
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
            />
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="email" className="text-[13px] font-medium text-[#a1a1a6]">
            Email
          </label>
          <input
            value={form.email}
            readOnly={Boolean(token || (authUser && !token))}
            onChange={(e) => updateForm('email', e.target.value)}
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            aria-label="Email"
            placeholder="you@example.com"
            required
            className={`h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors ${authUser && !token ? 'opacity-80 cursor-not-allowed' : ''}`}
          />
        </div>

        {/* M-Pesa Number */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[13px] font-medium text-[#a1a1a6]">
            M-Pesa number
          </label>
          <input
            value={form.mpesaNumber}
            onChange={(e) => updateForm('mpesaNumber', e.target.value)}
            aria-label="M-Pesa number"
            placeholder="0712 345 678"
            required
            className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
          />
        </div>

        {/* WhatsApp Number (optional) */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[13px] font-medium text-[#a1a1a6]">
            WhatsApp number (optional)
          </label>
          <input
            value={form.whatsappNumber}
            onChange={(e) => updateForm('whatsappNumber', e.target.value)}
            aria-label="WhatsApp number (optional)"
            placeholder="0712 345 678"
            className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="password" className="text-[13px] font-medium text-[#a1a1a6]">
            Password
          </label>
          <div className="relative w-full">
            <input
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              autoComplete="new-password"
              aria-label="Password"
              placeholder="••••••••"
              required
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

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#a1a1a6]">
            Confirm password
          </label>
          <div className="relative w-full">
            <input
              value={form.confirmPassword}
              onChange={(e) => updateForm('confirmPassword', e.target.value)}
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              aria-label="Confirm password"
              placeholder="••••••••"
              required
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] pl-4 pr-12 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#8a8a91] hover:text-white transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Password Requirements Checklist */}
        <PasswordChecklist
          password={form.password}
          confirmPassword={form.confirmPassword}
          title="PASSWORD CHECKLIST"
          showMatch={true}
        />

        {/* Terms Checkbox */}
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

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading || !passwordsMatch || !termsAccepted}
          aria-label="Create creator account"
          className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm mt-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create account'}
        </button>
      </form>

      {/* Existing account modal */}
      <Dialog open={existingAccountPrompt} onOpenChange={(open) => !open && setExistingAccountPrompt(false)}>
        <DialogContent className="w-[92vw] sm:max-w-md rounded-3xl border border-[#34343a] bg-[#27272c] text-white p-6 shadow-2xl transition-colors duration-200">
          <div className="w-12 h-12 rounded-2xl bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center text-2xl font-semibold">
            !
          </div>

          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">
              You already have a Byblos account
            </DialogTitle>
            <DialogDescription className="text-sm text-[#a1a1a6] leading-relaxed">
              Log in with your existing account, then add Creator access from your account switcher.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2.5">
            {existingAccountInfo?.hasSeller && !existingAccountInfo?.hasBuyer ? (
              <Button
                type="button"
                onClick={() => navigate('/seller/login')}
                className="btn-white h-11 flex-1 rounded-xl bg-white font-semibold text-black hover:bg-gray-100 border border-gray-200 shadow-sm transition"
              >
                Log in as Seller
              </Button>
            ) : existingAccountInfo?.hasBuyer && !existingAccountInfo?.hasSeller ? (
              <Button
                type="button"
                onClick={() => navigate('/buyer/login')}
                className="btn-white h-11 flex-1 rounded-xl bg-white font-semibold text-black hover:bg-gray-100 border border-gray-200 shadow-sm transition"
              >
                Log in as Buyer
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => navigate('/buyer/login')}
                  className="btn-white h-11 flex-1 rounded-xl bg-white font-semibold text-black hover:bg-gray-100 border border-gray-200 shadow-sm transition"
                >
                  Buyer Login
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/seller/login')}
                  className="btn-white h-11 flex-1 rounded-xl bg-white font-semibold text-black hover:bg-gray-100 border border-gray-200 shadow-sm transition"
                >
                  Seller Login
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setExistingAccountPrompt(false)}
              className="h-11 rounded-xl border-[#34343a] bg-transparent text-white hover:bg-white/10 transition"
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={() => setTermsAccepted(true)}
      />
    </PenpotAuthLayout>
  );
}
