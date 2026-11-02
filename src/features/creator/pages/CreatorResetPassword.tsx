import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { useResetPasswordMutation } from '@/features/auth/hooks/useAuthMutations';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist';

export default function CreatorResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const navigate = useNavigate();
  const resetMut = useResetPasswordMutation('creator');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const longEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;
  const linkValid = Boolean(token && email);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!linkValid) {
      toast.error('Invalid link', { description: 'This reset link is missing its token or email. Request a new one.' });
      return;
    }
    if (!longEnough) {
      toast.error('Weak password', { description: 'Use at least 8 characters.' });
      return;
    }
    if (!matches) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await resetMut.mutateAsync({ token, newPassword: password, email });
      toast.success('Password updated', { description: 'You can now log in with your new password.' });
      navigate('/creator/login', { replace: true });
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Reset failed', {
        description: err.response?.data?.message || err.message || 'The link may be invalid or expired.',
      });
    }
  };

  return (
    <PenpotAuthLayout
      roleTag="CREATOR PORTAL"
      title="Set a new password"
      subtitle="Choose a strong password for your creator account."
      showBackButton={true}
      onBack={() => navigate('/creator/login')}
    >
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        {/* New Password */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="password" className="text-[13px] font-medium text-[#a1a1a6]">
            New password
          </label>
          <div className="relative w-full">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
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

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5 w-full">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#a1a1a6]">
            Confirm password
          </label>
          <div className="relative w-full">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] pl-4 pr-12 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
            />
          </div>
        </div>

        {password.length > 0 && (
          <PasswordChecklist
            password={password}
            confirmPassword={confirm}
            showMatch={true}
          />
        )}

        <button
          type="submit"
          disabled={resetMut.isPending}
          aria-label="Update password"
          className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm mt-2 disabled:opacity-60 cursor-pointer"
        >
          {resetMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update password'}
        </button>
      </form>
    </PenpotAuthLayout>
  );
}
