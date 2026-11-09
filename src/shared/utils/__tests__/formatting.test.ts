import { describe, it, expect } from 'vitest';
import { getImageUrl } from '../formatting';

describe('getImageUrl utility', () => {
  it('returns placeholder for null, undefined, and empty input', () => {
    const placeholder = getImageUrl(null);
    expect(placeholder).toContain('data:image/svg+xml');
    expect(getImageUrl(undefined)).toBe(placeholder);
    expect(getImageUrl('')).toBe(placeholder);
    expect(getImageUrl('   ')).toBe(placeholder);
  });

  it('returns placeholder for literal string "null" and "undefined"', () => {
    const placeholder = getImageUrl(null);
    expect(getImageUrl('null')).toBe(placeholder);
    expect(getImageUrl('undefined')).toBe(placeholder);
    expect(getImageUrl(' null ')).toBe(placeholder);
  });

  it('preserves full http/https, data, and blob URLs', () => {
    expect(getImageUrl('https://res.cloudinary.com/byblos/image/upload/sample.jpg'))
      .toBe('https://res.cloudinary.com/byblos/image/upload/sample.jpg');
    expect(getImageUrl('http://example.com/pic.png'))
      .toBe('http://example.com/pic.png');
    expect(getImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))
      .toContain('data:image/png;base64');
    expect(getImageUrl('blob:http://localhost:3000/1234-5678'))
      .toBe('blob:http://localhost:3000/1234-5678');
  });

  it('normalizes relative path with leading slash', () => {
    const url = getImageUrl('uploads/images/prod_123.jpg');
    expect(url.endsWith('/uploads/images/prod_123.jpg')).toBe(true);
  });
});

