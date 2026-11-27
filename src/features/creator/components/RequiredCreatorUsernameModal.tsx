import { useEffect, useState } from 'react';
import { Loader2, LogOut, UserRound } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { checkCreatorUsernameAvailability } from '@/features/creator/api/auth';
import { useUpdateCreatorProfileMutation } from '@/features/creator/hooks/mutations/useUpdateCreatorProfileMutation';
import { validateCreatorUsername } from '@/features/creator/utils/creatorUsernameValidation';
import type { CreatorProfile } from '@/features/creator/utils/creatorDashboardUtils';

interface RequiredCreatorUsernameModalProps {
  creator: CreatorProfile;
  onLogout: () => void;
}

export function RequiredCreatorUsernameModal({ creator, onLogout }: Readonly<RequiredCreatorUsernameModalProps>) {
  const open = Boolean(creator?.id && creator.usernameConfirmed === false);
  const updateMutation = useUpdateCreatorProfileMutation();
  const [username, setUsername] = useState(creator?.username || '');
  const [availabilityMsg, setAvailabilityMsg] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (creator?.username && !username) {
      setUsername(creator.username);
    }
  }, [creator?.username, username]);

  const localCheck = validateCreatorUsername(username);

  useEffect(() => {
    if (!open || !localCheck.valid) {
      setAvailabilityMsg(null);
      setIsAvailable(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkCreatorUsernameAvailability(username);
        if (cancelled) return;
        setIsAvailable(res.available);
        setAvailabilityMsg(res.message);
      } catch {
        if (!cancelled) {
          setIsAvailable(null);
          setAvailabilityMsg(null);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, username, localCheck.valid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localCheck.valid) {
      toast.error(localCheck.error || 'Enter a valid username.');
      return;
    }
    try {
      await updateMutation.mutateAsync({ username: username.trim() });
      toast.success('Creator username saved! Your links now use your new username.');
    } catch (err: unknown) {
      toast.error(classifyApiError(err, 'Could not save your username.').message);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-[92vw] max-w-md border border-separator bg-surface-1 text-label [&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-label">
            <UserRound className="h-5 w-5 text-brand-text" />
            Choose your creator username
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-label-2 leading-relaxed">
            Creator links now use your unique username (for example <span className="font-semibold text-label">byblosafrica.site/shop/yourname</span>). Set your username to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label="Creator username"
              placeholder="e.g. roynthiga"
              className="h-11"
              required
            />
            {username.trim().length > 0 && !localCheck.valid && (
              <p className="text-xs text-sys-red">{localCheck.error}</p>
            )}
            {localCheck.valid && (
              <p className="text-xs text-label-3">
                Link preview: <span className="font-medium text-label">byblosafrica.site/&lt;shop&gt;/{localCheck.normalized}</span>
              </p>
            )}
            {checking && <p className="text-xs text-label-3">Checking availability…</p>}
            {!checking && availabilityMsg && (
              <p className={`text-xs font-medium ${isAvailable ? 'text-sys-green' : 'text-sys-red'}`}>
                {availabilityMsg}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onLogout} className="h-9 px-3 text-xs text-label-3">
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Log out
            </Button>
            <Button
              type="submit"
              disabled={!localCheck.valid || isAvailable === false || updateMutation.isPending}
              className="h-9 px-4"
            >
              {updateMutation.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : 'Save username'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
