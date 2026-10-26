import { describe, it, expect } from 'vitest';
import { getShopThemeAccentVars, type Theme } from '@/shared/hooks/useShopTheme';

describe('Shop Theme Accent Scoping (TDD)', () => {
  it('returns valid accent CSS variables for each supported theme palette', () => {
    const pinkVars = getShopThemeAccentVars('pink');
    expect(pinkVars['--theme-accent']).toBe('#db2777');
    expect(pinkVars['--theme-button-bg']).toBe('#db2777');

    const greenVars = getShopThemeAccentVars('green');
    expect(greenVars['--theme-accent']).toBe('#059669');
    expect(greenVars['--theme-button-bg']).toBe('#059669');

    const orangeVars = getShopThemeAccentVars('orange');
    expect(orangeVars['--theme-accent']).toBe('#ea580c');
    expect(orangeVars['--theme-button-bg']).toBe('#ea580c');

    const defaultVars = getShopThemeAccentVars('default');
    expect(defaultVars['--theme-accent']).toBe('#f5c518');
    expect(defaultVars['--theme-button-bg']).toBe('#f5c518');
  });

  it('falls back to default yellow variables if an unrecognized theme name is passed', () => {
    const fallbackVars = getShopThemeAccentVars('unknown-theme' as unknown as Theme);
    expect(fallbackVars['--theme-accent']).toBe('#f5c518');
  });
});
