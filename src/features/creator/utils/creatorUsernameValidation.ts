const CREATOR_USERNAME_REGEX = /^[a-zA-Z0-9._\s-]+$/;

export function normalizeCreatorUsernameSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateCreatorUsername(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = String(raw || '').trim();
  if (trimmed.length <= 3) {
    return {
      valid: false,
      normalized: '',
      error: 'Username must be more than 3 characters (at least 4).',
    };
  }
  if (trimmed.length > 30) {
    return {
      valid: false,
      normalized: '',
      error: 'Username must be at most 30 characters.',
    };
  }
  if (!CREATOR_USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      error: 'Username can only contain letters, numbers, spaces, dots, dashes, and underscores.',
    };
  }
  const normalized = normalizeCreatorUsernameSlug(trimmed);
  if (normalized.length <= 3) {
    return {
      valid: false,
      normalized: '',
      error: 'Username must contain more than 3 letters or numbers.',
    };
  }
  return { valid: true, normalized };
}

