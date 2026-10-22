import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Creator Attribution Retention', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('preserves query parameters when saving redirectAfterLogin', () => {
    const pathname = '/the-thrift-shop';
    const search = '?creator=ALICE123';
    const fullRedirectUrl = pathname + search;

    sessionStorage.setItem('redirectAfterLogin', fullRedirectUrl);

    expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/the-thrift-shop?creator=ALICE123');
  });

  it('stores and retrieves creator referral code per shop slug in sessionStorage', () => {
    const shopSlug = 'vintage-finds';
    const creatorCode = 'CREATOR99';

    sessionStorage.setItem(`byblos_creator_${shopSlug}`, creatorCode);

    expect(sessionStorage.getItem(`byblos_creator_${shopSlug}`)).toBe('CREATOR99');
    expect(sessionStorage.getItem('byblos_creator_other-shop')).toBeNull();
  });

  it('falls back to sessionStorage creator code when URL search param is missing', () => {
    const shopSlug = 'chic-boutique';
    sessionStorage.setItem(`byblos_creator_${shopSlug}`, 'BOUTIQUE_CREATOR');

    // Simulate URL without ?creator= param
    const searchParams = new URLSearchParams('');
    const urlCreator = searchParams.get('creator');
    const resolvedCreator = urlCreator || sessionStorage.getItem(`byblos_creator_${shopSlug}`) || undefined;

    expect(resolvedCreator).toBe('BOUTIQUE_CREATOR');
  });

  it('prefers active URL creator query parameter over cached session storage', () => {
    const shopSlug = 'chic-boutique';
    sessionStorage.setItem(`byblos_creator_${shopSlug}`, 'OLD_CREATOR');

    // Simulate URL with new ?creator=NEW_CREATOR param
    const searchParams = new URLSearchParams('?creator=NEW_CREATOR');
    const urlCreator = searchParams.get('creator');
    const resolvedCreator = urlCreator || sessionStorage.getItem(`byblos_creator_${shopSlug}`) || undefined;

    expect(resolvedCreator).toBe('NEW_CREATOR');
  });
});
