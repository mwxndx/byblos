import { describe, test, expect, afterEach } from 'vitest';
import { getDevicePlatform, isAppInstalled } from './mobileApp';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
// iPadOS 13+ Safari and modern Macs share this exact "Macintosh" UA — only
// maxTouchPoints tells them apart.
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
}
function setMaxTouchPoints(value: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value, configurable: true });
}

afterEach(() => {
  setUserAgent(IPHONE_UA); // reset to a known value; each test sets its own
  setMaxTouchPoints(0);
});

describe('getDevicePlatform', () => {
  test('Android UA → android', () => {
    setUserAgent(ANDROID_UA);
    setMaxTouchPoints(5);
    expect(getDevicePlatform()).toBe('android');
  });

  test('iPhone UA → ios', () => {
    setUserAgent(IPHONE_UA);
    setMaxTouchPoints(5);
    expect(getDevicePlatform()).toBe('ios');
  });

  test('real Mac (Macintosh UA, no touch) → desktop', () => {
    setUserAgent(MAC_UA);
    setMaxTouchPoints(0);
    expect(getDevicePlatform()).toBe('desktop');
  });

  // The bug this fixes: an iPad reports a Macintosh UA but has touch points.
  test('iPadOS 13+ (Macintosh UA + maxTouchPoints > 1) → ios, not desktop', () => {
    setUserAgent(MAC_UA);
    setMaxTouchPoints(5);
    expect(getDevicePlatform()).toBe('ios');
  });

  test('Mac reporting a single touch point → still desktop', () => {
    setUserAgent(MAC_UA);
    setMaxTouchPoints(1);
    expect(getDevicePlatform()).toBe('desktop');
  });
});

describe('isAppInstalled', () => {
  test('true when display-mode is standalone', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({ matches: q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {} }),
    });
    expect(isAppInstalled()).toBe(true);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: original });
  });

  test('false in a normal browser tab', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }),
    });
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: false });
    expect(isAppInstalled()).toBe(false);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: original });
  });
});
