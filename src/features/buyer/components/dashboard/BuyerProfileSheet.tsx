import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Edit3, LogOut, Mail, MapPin, MessageCircle, Phone, UserRound } from '@/shared/ui/icons';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { DashboardProfilePanel } from '@/shared/components/DashboardProfilePanel';
import { BuyerMembershipCard } from './BuyerMembershipCard';
import { DeleteAccountButton } from '@/shared/components/DeleteAccountButton';
import { deleteBuyerAccount } from '@/features/buyer/api/profile';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { ThemeSegmentedPill } from '@/shared/ui/ThemeSegmentedPill';
import { LegalLinks } from '@/shared/components/LegalLinks';
import { IosNotificationProfileRow } from '@/features/notifications/components/IosNotificationProfileRow';

interface BuyerProfileContentProps {
  isEditingProfile: boolean;
  isSavingProfile: boolean;
  mobilePayment: string;
  area: string;
  user: import("@/features/auth/types/authTypes").UserProfile | null;
  whatsappNumber: string;
  onLogout: () => void;
  onMobilePaymentChange: (value: string) => void;
  onAreaChange: (value: string) => void;
  onSaveProfile: () => void;
  onToggleEdit: () => void;
  onWhatsappNumberChange: (value: string) => void;
}

function displayValue(value?: string | null) {
  return value?.trim() || 'Not set';
}

function BuyerPreferencesRow() {
  const { theme, setTheme } = useThemeScope('buyer');

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-[#a1a1a6]">
          Theme
        </span>
        <ThemeSegmentedPill value={theme} onChange={setTheme} className="w-full justify-center" />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-[#a1a1a6]">
          Account
        </span>
        <AccountSwitcher triggerClassName="w-full justify-center" />
      </div>
    </div>
  );
}

/**
 * One account field matching Penpot tokens.
 */
function ProfileDetail({
  icon: Icon,
  label,
  value,
  editable,
  editing,
  placeholder,
  onChange,
  inputMode = 'tel',
  autoComplete = 'tel',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  editable?: boolean;
  editing?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  const isInput = Boolean(editable && editing);
  return (
    <div className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#121214] p-3.5 transition-colors">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#a1a1a6]">
        <Icon className="h-3.5 w-3.5 text-[#f5c518]" />
        <span>{label}</span>
      </div>
      {isInput ? (
        <Input
          value={value ?? ''}
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="mt-2 h-11 border border-slate-300 dark:border-[#34343a] bg-white dark:bg-[#27272c] text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8a8a91] rounded-[10px] focus-visible:ring-[#f5c518]"
        />
      ) : (
        <div className="mt-1.5 break-words text-sm font-semibold leading-5 text-slate-950 dark:text-white">
          {displayValue(value)}
        </div>
      )}
    </div>
  );
}

export function BuyerProfileContent({
  isEditingProfile,
  isSavingProfile,
  mobilePayment,
  area,
  user,
  whatsappNumber,
  onLogout,
  onMobilePaymentChange,
  onAreaChange,
  onSaveProfile,
  onToggleEdit,
  onWhatsappNumberChange
}: BuyerProfileContentProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeScope('buyer');
  const buyerUser = user as import("@/features/auth/types/authTypes").BuyerProfile | null;

  // Unauthenticated Guest View: prompt sign-in / registration with existing flows
  if (!user) {
    return (
      <div className="w-full space-y-4">
        {/* Welcome & Sign-In Card matching Penpot Buyer – Profile (signed out) */}
        <section className="space-y-3.5 rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-6 shadow-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5c518]/15 border border-[#f5c518]/30 text-[#f5c518]">
            <UserRound className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-950 dark:text-white">Welcome to Byblos</h3>
          <p className="text-sm text-slate-600 dark:text-[#a1a1a6] leading-relaxed max-w-xs mx-auto">
            Sign in to track orders, save favorites and check out faster.
          </p>
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                navigate('/buyer/login');
              }}
              className="h-12 w-full rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/buyer/register')}
              className="h-12 w-full rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-transparent font-semibold text-sm text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Create Account
            </button>
          </div>
        </section>

        {/* Theme Preference */}
        <section className="space-y-2 rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#a1a1a6]">
            Theme
          </span>
          <ThemeSegmentedPill value={theme} onChange={setTheme} className="w-full justify-center" />
        </section>

        {/* Portals: Become a Seller or Creator */}
        <section className="space-y-3 rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Partner with Byblos</h4>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/seller/register')}
              className="h-10 rounded-[12px] border border-slate-200 dark:border-[#34343a] bg-transparent text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Become a Seller
            </button>
            <button
              type="button"
              onClick={() => navigate('/creator/register')}
              className="h-10 rounded-[12px] border border-slate-200 dark:border-[#34343a] bg-transparent text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Add Creator
            </button>
          </div>
        </section>

        {/* Legal Links */}
        <section className="space-y-2 px-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Legal</h3>
          <LegalLinks />
        </section>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* App theme + account switcher - one equal row above account details */}
      <section className="space-y-3 rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-4 shadow-sm">
        <BuyerPreferencesRow />
        <IosNotificationProfileRow />
      </section>

      {/* Account Details Section */}
      <section className="space-y-3.5 rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">Account Details</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#a1a1a6]">
              {isEditingProfile ? 'Update your payment and WhatsApp numbers.' : 'Your saved buyer information.'}
            </p>
          </div>
          <Button
            type="button"
            onClick={onToggleEdit}
            variant="outline"
            className="h-9 shrink-0 gap-1.5 border-slate-200 dark:border-[#34343a] bg-transparent px-3 text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-[10px]"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {isEditingProfile ? 'Cancel' : 'Edit'}
          </Button>
        </div>

        <div className="grid gap-2.5">
          <ProfileDetail icon={UserRound} label="Full name" value={buyerUser?.fullName} />
          <ProfileDetail icon={Mail} label="Email address" value={buyerUser?.email} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ProfileDetail icon={MapPin} label="City" value={buyerUser?.city} />
            <ProfileDetail
              icon={MapPin}
              label="Area"
              value={area}
              editable
              editing={isEditingProfile}
              placeholder="Your area"
              onChange={onAreaChange}
              inputMode="text"
              autoComplete="address-level2"
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ProfileDetail
              icon={Phone}
              label="Mobile payment"
              value={mobilePayment}
              editable
              editing={isEditingProfile}
              placeholder="Mobile payment number"
              onChange={onMobilePaymentChange}
            />
            <ProfileDetail
              icon={MessageCircle}
              label="WhatsApp"
              value={whatsappNumber}
              editable
              editing={isEditingProfile}
              placeholder="WhatsApp number"
              onChange={onWhatsappNumberChange}
            />
          </div>
        </div>

        {isEditingProfile && (
          <button
            type="button"
            onClick={onSaveProfile}
            disabled={isSavingProfile}
            className="h-14 w-full rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {isSavingProfile ? 'Saving...' : 'Save changes'}
          </button>
        )}
      </section>

      <BuyerMembershipCard />

      <section className="space-y-2 px-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Legal</h3>
        <LegalLinks />
      </section>

      <div className="space-y-2.5 rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-4">
        <button
          type="button"
          onClick={onLogout}
          className="h-12 w-full rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-transparent text-[#ff5a52] font-semibold text-sm hover:bg-red-500/10 flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
        <DeleteAccountButton deleteAccount={deleteBuyerAccount} onDeleted={onLogout} />
      </div>
    </div>
  );
}

interface BuyerProfileSheetProps extends BuyerProfileContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Buyer profile contained by the dashboard body. It intentionally leaves the
 * shared header and fixed bottom navigation visible above the profile panel.
 */
export function BuyerProfileSheet({ open, onOpenChange, ...content }: Readonly<BuyerProfileSheetProps>) {
  return (
    <DashboardProfilePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Profile"
      bottomInset="calc(4rem + var(--sab, env(safe-area-inset-bottom, 0px)))"
    >
      <div className="px-4 py-4 pb-8">
        <BuyerProfileContent {...content} />
      </div>
    </DashboardProfilePanel>
  );
}
