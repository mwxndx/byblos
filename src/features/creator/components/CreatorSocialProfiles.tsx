import React, { useState, useEffect } from 'react';
import { ExternalLink, Check, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import instagramLogo from '@/assets/social/instagram.png';
import tiktokLogo from '@/assets/social/tiktok.png';
import { socialUrl } from '@/features/shop/utils/socialLinks';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { useUpdateCreatorProfileMutation } from '../hooks/mutations/useUpdateCreatorProfileMutation';
import type { CreatorProfile } from '../utils/creatorDashboardUtils';

interface CreatorSocialProfilesProps {
  profile?: CreatorProfile;
}

export function CreatorSocialProfiles({ profile }: CreatorSocialProfilesProps) {
  const [instagram, setInstagram] = useState(profile?.instagramLink || '');
  const [tiktok, setTiktok] = useState(profile?.tiktokLink || '');
  const updateMutation = useUpdateCreatorProfileMutation();

  useEffect(() => {
    if (profile) {
      setInstagram(profile.instagramLink || '');
      setTiktok(profile.tiktokLink || '');
    }
  }, [profile?.instagramLink, profile?.tiktokLink]);

  const hasChanges =
    (instagram.trim() || null) !== (profile?.instagramLink || null) ||
    (tiktok.trim() || null) !== (profile?.tiktokLink || null);

  const instagramHref = socialUrl('instagram', instagram);
  const tiktokHref = socialUrl('tiktok', tiktok);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        instagramLink: instagram.trim() || null,
        tiktokLink: tiktok.trim() || null,
      });
      toast.success('Social profiles saved successfully!');
    } catch (err: unknown) {
      // classifyApiError distinguishes network/timeout/HTTP-body failures,
      // matching every sibling handler in this feature.
      toast.error(classifyApiError(err, 'Could not update social profiles.').message);
    }
  };

  const handleRemove = async (network: 'instagram' | 'tiktok') => {
    try {
      await updateMutation.mutateAsync(
        network === 'instagram' ? { instagramLink: null } : { tiktokLink: null }
      );
      if (network === 'instagram') setInstagram(''); else setTiktok('');
      toast.success(`${network === 'instagram' ? 'Instagram' : 'TikTok'} link removed.`);
    } catch (err: unknown) {
      toast.error(classifyApiError(err, 'Could not remove link.').message);
    }
  };

  return (
    <section className="rounded-card border border-separator bg-surface-1 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-label">Social media accounts</h2>
            <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] px-2.5 py-0.5 text-xs font-medium text-brand-text">
              <Sparkles className="h-3 w-3" />
              Creator reach
            </span>
          </div>
          <p className="mt-1 text-xs text-label-3 sm:text-sm">
            Connect your Instagram and TikTok so shop sellers can verify your audience and approve collaboration requests faster.
          </p>
        </div>

        {(profile?.instagramLink || profile?.tiktokLink) && (
          <span className="flex items-center gap-1 text-xs font-medium text-sys-green">
            <Check className="h-3.5 w-3.5" /> Profiles linked
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Instagram input */}
          <div className="rounded-control border border-separator bg-surface-2 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <img src={instagramLogo} alt="Instagram" className="h-5 w-5 shrink-0 object-contain" />
                <label className="truncate text-xs font-medium text-label">Instagram profile</label>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {instagramHref && (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open Instagram link"
                    className="rounded-md p-1 text-label-2 transition-colors hover:bg-fill hover:text-label"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {profile?.instagramLink && (
                  <button
                    type="button"
                    onClick={() => handleRemove('instagram')}
                    disabled={updateMutation.isPending}
                    aria-label="Remove Instagram link"
                    className="rounded-md p-1 text-sys-red transition-colors hover:bg-[color-mix(in_srgb,var(--sys-red)_14%,transparent)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourhandle or instagram.com/username"
              className="h-10 text-xs sm:text-sm"
            />
            <p className="mt-1.5 text-[11px] text-label-3">Enter your handle with @ or your full profile URL</p>
          </div>

          {/* TikTok input */}
          <div className="rounded-control border border-separator bg-surface-2 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <img src={tiktokLogo} alt="TikTok" className="h-5 w-5 shrink-0 object-contain" />
                <label className="truncate text-xs font-medium text-label">TikTok profile</label>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {tiktokHref && (
                  <a
                    href={tiktokHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open TikTok link"
                    className="rounded-md p-1 text-label-2 transition-colors hover:bg-fill hover:text-label"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {profile?.tiktokLink && (
                  <button
                    type="button"
                    onClick={() => handleRemove('tiktok')}
                    disabled={updateMutation.isPending}
                    aria-label="Remove TikTok link"
                    className="rounded-md p-1 text-sys-red transition-colors hover:bg-[color-mix(in_srgb,var(--sys-red)_14%,transparent)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Input
              type="text"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="@yourhandle or tiktok.com/@username"
              className="h-10 text-xs sm:text-sm"
            />
            <p className="mt-1.5 text-[11px] text-label-3">Enter your TikTok username or profile link</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInstagram(profile?.instagramLink || '');
                setTiktok(profile?.tiktokLink || '');
              }}
              disabled={updateMutation.isPending}
              className="h-9 text-xs"
            >
              Reset
            </Button>
          )}
          <Button
            type="submit"
            disabled={!hasChanges || updateMutation.isPending}
            className="h-9 px-5 text-xs"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save social links'
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
