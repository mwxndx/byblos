import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Cold Launch & Splash Screen Verification (Android & iOS PWA)', () => {
  const rootDir = process.cwd();

  describe('Android Native Cold Launch Configuration', () => {
    it('configures Android 12+ (API 31+) SplashScreen theme with black background and centered icon', () => {
      const stylesPath = path.join(rootDir, 'android/app/src/main/res/values/styles.xml');
      const stylesV31Path = path.join(rootDir, 'android/app/src/main/res/values-v31/styles.xml');
      
      const v31Exists = fs.existsSync(stylesV31Path);
      const stylesContent = fs.readFileSync(v31Exists ? stylesV31Path : stylesPath, 'utf8');

      // Android 12+ WindowManager requires Theme.SplashScreen and windowSplashScreenBackground
      // to avoid falling back to white (?android:attr/colorBackground = #FFFFFF)
      expect(stylesContent).toContain('Theme.SplashScreen');
      expect(stylesContent).toContain('windowSplashScreenBackground');
      expect(stylesContent).toMatch(/@color\/byblos_launch_background|#000000/);
      expect(stylesContent).toContain('windowSplashScreenAnimatedIcon');
      expect(stylesContent).toContain('@drawable/splash_icon');
      expect(stylesContent).toContain('postSplashScreenTheme');
    });

    it('ensures Android splash layer-list centers the icon without distortion', () => {
      const splashXmlPath = path.join(rootDir, 'android/app/src/main/res/drawable/splash.xml');
      expect(fs.existsSync(splashXmlPath)).toBe(true);
      const content = fs.readFileSync(splashXmlPath, 'utf8');
      expect(content).toContain('layer-list');
      expect(content).toContain('gravity="center"');
      expect(content).toContain('@drawable/splash_icon');
    });

    it('invokes SplashScreen.installSplashScreen in MainActivity before super.onCreate', () => {
      const mainActivityPath = path.join(
        rootDir,
        'android/app/src/main/java/space/bybloshq/app/MainActivity.java'
      );
      const content = fs.readFileSync(mainActivityPath, 'utf8');

      expect(content).toContain('androidx.core.splashscreen.SplashScreen');
      expect(content).toContain('SplashScreen.installSplashScreen(this)');

      // Verify it is called before super.onCreate
      const installIndex = content.indexOf('SplashScreen.installSplashScreen(this)');
      const superIndex = content.indexOf('super.onCreate(savedInstanceState)');
      expect(installIndex).toBeGreaterThan(-1);
      expect(superIndex).toBeGreaterThan(-1);
      expect(installIndex).toBeLessThan(superIndex);
    });
  });

  describe('iOS PWA Cold Launch & Startup Image Configuration', () => {
    let indexHtmlContent: string;

    beforeAll(() => {
      const indexHtmlPath = path.join(rootDir, 'index.html');
      indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    });

    it('sets apple-mobile-web-app-status-bar-style to black-translucent in index.html to avoid white canvas', () => {
      expect(indexHtmlContent).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
      // The inline theme script should also maintain black-translucent
      expect(indexHtmlContent).not.toMatch(/statusMeta\.setAttribute\(['"]content['"],\s*['"]default['"]\)/);
    });

    it('ensures all iOS PWA startup images use black background instead of flashing white light-mode images', () => {
      // Light splash images (apple-splash-light-*.png) have a light/cream background (#f5f4f0),
      // which causes iOS PWA cold launch in light mode to display a white screen before the dark logo splash.
      const lightSplashMatches = indexHtmlContent.match(/<link\s+rel="apple-touch-startup-image"[^>]+apple-splash-light[^>]+>/g);
      expect(lightSplashMatches).toBeNull();

      // Verify no duplicate fallback link tags
      const fallbackMatches = indexHtmlContent.match(/<link\s+rel="apple-touch-startup-image"\s+href="\/apple-splash-dark\.png">/g);
      expect(fallbackMatches?.length).toBe(1);
    });

    it('covers all modern iPhone resolutions with exact pixel dimensions', () => {
      const expectedResolutions = [
        '1320x2868', // iPhone 16 Pro Max
        '1290x2796', // iPhone 15/16 Plus, 14/15 Pro Max
        '1284x2778', // iPhone 14 Plus, 12/13 Pro Max
        '1206x2622', // iPhone 16 Pro
        '1179x2556', // iPhone 14/15/16 Pro
        '1170x2532', // iPhone 12/13/14
        '1242x2688', // iPhone XS Max, 11 Pro Max
        '828x1792',  // iPhone 11, XR
        '1125x2436', // iPhone X, XS, 11 Pro
        '750x1334',  // iPhone SE 2/3
      ];

      for (const res of expectedResolutions) {
        expect(indexHtmlContent).toContain(`/apple-splash-dark-${res}.png`);
        const filePath = path.join(rootDir, `public/apple-splash-dark-${res}.png`);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it('locks #initial-splash to pure black (#000000) for standalone PWA and native app cold launch', () => {
      expect(indexHtmlContent).toContain('@media (display-mode: standalone)');
      expect(indexHtmlContent).toMatch(/@media \(display-mode: standalone\)\s*\{\s*#initial-splash\s*\{\s*background-color:\s*#000000 !important;/);
    });

    it('allows standard browser tabs in light theme to use harmonious cream background (#f5f4f0)', () => {
      expect(indexHtmlContent).toContain('@media not all and (display-mode: standalone)');
      expect(indexHtmlContent).toMatch(/html\[data-theme="light"\]:not\(\.native-app\):not\(\.capacitor-native\)(:not\(\.pwa-standalone\))?\s+#initial-splash/);
      expect(indexHtmlContent).toMatch(/background-color:\s*#f5f4f0 !important;/);
    });
  });
});
