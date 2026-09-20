import { useEffect, useRef, useState } from 'react';
import { LogOut, Mail, MessageCircle, Phone, UserRound, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ThemeSegmentedPill } from '@/shared/ui/ThemeSegmentedPill';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { CreatorSocialProfiles } from '@/features/creator/components/CreatorSocialProfiles';
import { CreatorWithdrawalPanel } from '@/features/creator/components/CreatorWithdrawalPanel';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { useUpdateCreatorProfileMutation } from '@/features/creator/hooks/mutations/useUpdateCreatorProfileMutation';
import { LegalLinks } from '@/shared/components/LegalLinks';
import type { CreatorProfile, CreatorClearance, WithdrawalRow } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CreatorProfile;
  clearance?: CreatorClearance;
  withdrawals: WithdrawalRow[];
  onLogout: () => void;
  focusWithdrawals?: boolean;
}

function ReadOnlyDetail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  return (
    <div className="rounded-control border border-separator bg-surface-2 p-3">
      <div className="flex items-center justify-between text-xs font-medium text-label-2">
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-brand-text" />{label}</span>
        <span className="flex items-center gap-1 text-label-3"><Lock className="h-3 w-3" />Read-only</span>
      </div>
      <div className="mt-2 break-words text-sm font-medium leading-5 text-label">{value?.trim() || 'Not set'}</div>
    </div>
  );
}

export function CreatorProfileSheet({ open, onOpenChange, creator, clearance, withdrawals, onLogout, focusWithdrawals }: CreatorProfileSheetProps) {
  const { theme, setTheme } = useThemeScope('creator');
  const updateMutation = useUpdateCreatorProfileMutation();
  const withdrawRef = useRef<HTMLDivElement>(null);

  const [mpesa, setMpesa] = useState(creator.mpesaNumber || '');
  const [whatsapp, setWhatsapp] = useState(creator.whatsappNumber || '');

  useEffect(() => {
    setMpesa(creator.mpesaNumber || '');
    setWhatsapp(creator.whatsappNumber || '');
  }, [creator.mpesaNumber, creator.whatsappNumber]);

  useEffect(() => {
    if (open && focusWithdrawals) {
      const id = setTimeout(() => withdrawRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220);
      return () => clearTimeout(id);
    }
  }, [open, focusWithdrawals]);

  const contactChanged =
    (mpesa.trim() || '') !== (creator.mpesaNumber || '') ||
    (whatsapp.trim() || '') !== (creator.whatsappNumber || '');

  const fullName = [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim();

  const handleSaveContact = async () => {
    try {
      await updateMutation.mutateAsync({
        mpesaNumber: mpesa.trim() || undefined,
        whatsappNumber: whatsapp.trim() || null
      });
      toast.success('Details saved.');
    } catch (err: unknown) {
      toast.error(classifyApiError(err, 'Could not save your details.').message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-surface-1 p-0 text-label sm:max-w-md"
      >
        <SheetHeader className="px-4 pb-2 pt-6 text-left">
          <SheetTitle className="text-label">Profile</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {/* Theme */}
          <section className="rounded-card border border-separator bg-surface-1 p-4">
            <span className="text-sm font-medium text-label-2">Theme</span>
            <ThemeSegmentedPill value={theme} onChange={setTheme} className="mt-2 flex w-full [&>button]:flex-1" />
          </section>

          {/* Personal details */}
          <section className="space-y-3 rounded-card border border-separator bg-surface-1 p-4">
            <h3 className="text-sm font-semibold text-label">Personal details</h3>
            <ReadOnlyDetail icon={UserRound} label="Full name" value={fullName} />
            <ReadOnlyDetail icon={Mail} label="Email" value={creator.email} />

            <div className="rounded-control border border-separator bg-surface-2 p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-label-2">
                <Phone className="h-3.5 w-3.5 text-brand-text" />M-Pesa number
              </label>
              <Input
                value={mpesa}
                onChange={(e) => setMpesa(e.target.value)}
                placeholder="0712345678"
                inputMode="tel"
                className="mt-2 h-9"
              />
              <p className="mt-1 text-[11px] text-label-3">Where your withdrawals are paid.</p>
            </div>

            <div className="rounded-control border border-separator bg-surface-2 p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-label-2">
                <MessageCircle className="h-3.5 w-3.5 text-brand-text" />WhatsApp number
              </label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="0712345678"
                inputMode="tel"
                className="mt-2 h-9"
              />
            </div>

            <Button
              type="button"
              onClick={handleSaveContact}
              disabled={!contactChanged || updateMutation.isPending}
              className="h-9 w-full"
            >
              {updateMutation.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : 'Save details'}
            </Button>
          </section>

          {/* Social media */}
          <CreatorSocialProfiles profile={creator} />

          {/* Withdrawals */}
          <div ref={withdrawRef} className="scroll-mt-4">
            <CreatorWithdrawalPanel creator={creator} clearance={clearance} withdrawals={withdrawals} />
          </div>

          {/* Legal */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-label">Legal</h3>
            <LegalLinks />
          </section>

          {/* Logout */}
          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className="h-10 w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
