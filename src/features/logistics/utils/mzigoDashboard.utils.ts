export { formatCurrency } from '@/shared/utils/formatting';

export function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function deadlineText(value?: string | null, now = Date.now()) {
  if (!value) return 'No deadline';
  const deadline = new Date(value).getTime();
  const diff = deadline - now;
  const absoluteHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
  const label = absoluteHours > 0 ? `${absoluteHours}h ${minutes}m` : `${minutes}m`;
  return diff < 0 ? `Overdue by ${label}` : `${label} left`;
}

export function statusLabel(status?: string | null) {
  return String(status || 'not requested').replace(/_/g, ' ');
}

export interface HandoverCodeValidationResult {
  isValid: boolean;
  sanitized: string;
  error?: string;
}

export function validateHandoverCode(code?: string | null): HandoverCodeValidationResult {
  const sanitized = String(code || '').trim().toUpperCase();
  if (!sanitized) {
    return { isValid: false, sanitized: '', error: 'Verification code cannot be empty.' };
  }
  if (sanitized.length < 4) {
    return { isValid: false, sanitized, error: 'Verification code must be at least 4 characters.' };
  }
  if (sanitized.length > 24) {
    return { isValid: false, sanitized, error: 'Verification code cannot exceed 24 characters.' };
  }
  if (!/^[A-Z0-9-]+$/.test(sanitized)) {
    return { isValid: false, sanitized, error: 'Verification code may only contain letters, numbers, and hyphens.' };
  }
  return { isValid: true, sanitized };
}
