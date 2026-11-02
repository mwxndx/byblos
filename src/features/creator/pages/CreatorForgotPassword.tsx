import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { useForgotPasswordMutation } from '@/features/auth/hooks/useAuthMutations';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';

export default function CreatorForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const forgotMut = useForgotPasswordMutation('creator');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await forgotMut.mutateAsync(email.trim());
      setSent(true);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Request failed', {
        description: err.response?.data?.message || err.message || 'Please try again in a moment.',
      });
    }
  };

  if (sent) {
    return (
      <PenpotAuthLayout
        roleTag="CREATOR PORTAL"
        title="Check your email"
        subtitle="We’ve sent a reset link to your inbox. It can take a minute to arrive."
        showTrustLine={true}
        showBackButton={true}
        onBack={() => navigate('/creator/login')}
      >
        <div className="w-full flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[#f5c518]/15 border border-[#f5c518]/30 flex items-center justify-center text-[#f5c518]">
            <Mail className="w-8 h-8" />
          </div>

          <p className="text-[14px] text-center text-[#a1a1a6] leading-relaxed">
            If an account exists for <span className="text-white font-medium">{email}</span>, follow the instructions in the email to reset your password.
          </p>

          <Link
            to="/creator/login"
            className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm mt-2"
          >
            Back to log in
          </Link>
        </div>
      </PenpotAuthLayout>
    );
  }

  return (
    <PenpotAuthLayout
      roleTag="CREATOR PORTAL"
      title="Reset your password"
      subtitle="Enter the email linked to your account and we’ll send you a reset link."
      showTrustLine={true}
      showBackButton={true}
      onBack={() => navigate('/creator/login')}
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
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-label="Email"
            required
            disabled={forgotMut.isPending}
            className="h-14 w-full bg-[#27272c] border border-[#34343a] focus:border-[#f5c518] focus:outline-none rounded-[14.5px] px-4 text-white text-[16px] placeholder-[#8a8a91] transition-colors"
          />
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={forgotMut.isPending}
          aria-label="Send reset link"
          className="btn-white h-14 w-full rounded-[14.5px] bg-white font-semibold text-black hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center text-[16px] shadow-sm mt-2 disabled:opacity-60 cursor-pointer"
        >
          {forgotMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
        </button>

        {/* Back link */}
        <div className="flex justify-center pt-2">
          <Link
            to="/creator/login"
            className="text-[14px] font-medium text-[#f5c518] hover:underline transition-colors"
          >
            Back to log in
          </Link>
        </div>
      </form>
    </PenpotAuthLayout>
  );
}
