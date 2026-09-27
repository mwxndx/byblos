import { describe, test, expect } from 'vitest';
import { resolveInstallUI } from './installState';

describe('resolveInstallUI', () => {
  test('installed app → none, whatever the platform', () => {
    expect(resolveInstallUI({ platform: 'ios', installed: true, snoozedUntil: null })).toBe('none');
    expect(resolveInstallUI({ platform: 'android', installed: true, snoozedUntil: null })).toBe('none');
  });

  test('desktop → none (mobile-only for now)', () => {
    expect(resolveInstallUI({ platform: 'desktop', installed: false, snoozedUntil: null })).toBe('none');
  });

  test('iOS, not installed, not snoozed → ios-instructions', () => {
    expect(resolveInstallUI({ platform: 'ios', installed: false, snoozedUntil: null })).toBe('ios-instructions');
  });

  test('Android, not installed, not snoozed → android-button', () => {
    expect(resolveInstallUI({ platform: 'android', installed: false, snoozedUntil: null })).toBe('android-button');
  });

  test('within an active snooze → none', () => {
    const now = 1_000_000;
    expect(resolveInstallUI({ platform: 'ios', installed: false, snoozedUntil: now + 5000, now })).toBe('none');
  });

  test('after the snooze expires → shows again', () => {
    const now = 1_000_000;
    expect(resolveInstallUI({ platform: 'android', installed: false, snoozedUntil: now - 1, now })).toBe('android-button');
  });
});
