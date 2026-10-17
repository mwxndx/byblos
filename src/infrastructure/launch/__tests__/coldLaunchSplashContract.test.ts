import { describe, it, expect } from 'vitest';
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
      expect(stylesContent).toContain('postSplashScreenTheme');
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
    it('sets apple-mobile-web-app-status-bar-style to black-translucent in index.html to avoid white canvas', () => {
      const indexHtmlPath = path.join(rootDir, 'index.html');
      const content = fs.readFileSync(indexHtmlPath, 'utf8');

      expect(content).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
      // The inline theme script should also maintain black-translucent
      expect(content).not.toMatch(/statusMeta\.setAttribute\(['"]content['"],\s*['"]default['"]\)/);
    });

    it('ensures all iOS PWA startup images use black background instead of flashing white light-mode images', () => {
      const indexHtmlPath = path.join(rootDir, 'index.html');
      const content = fs.readFileSync(indexHtmlPath, 'utf8');

      // Light splash images (apple-splash-light-*.png) have a light/cream background (#f5f4f0),
      // which causes iOS PWA cold launch in light mode to display a white screen before the dark logo splash.
      const lightSplashMatches = content.match(/<link\s+rel="apple-touch-startup-image"[^>]+apple-splash-light[^>]+>/g);
      expect(lightSplashMatches).toBeNull();
    });

    it('ensures #initial-splash always retains pure black background (#000000) during pre-hydration boot', () => {
      const indexHtmlPath = path.join(rootDir, 'index.html');
      const content = fs.readFileSync(indexHtmlPath, 'utf8');

      // #initial-splash must not be overridden to light/cream (#f5f4f0) during initial boot
      expect(content).not.toMatch(/html\[data-theme=["']light["']\]\s+#initial-splash\s*\{\s*background-color:\s*#f5f4f0/);
      expect(content).not.toMatch(/html\.light\s+#initial-splash\s*\{\s*background-color:\s*#f5f4f0/);
    });
  });
});
