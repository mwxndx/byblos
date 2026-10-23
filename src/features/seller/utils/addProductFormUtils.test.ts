import { describe, expect, it } from 'vitest';
import {
  buildProductData,
  formDataDefaults,
  hasServiceCoordinates,
  validateStep1,
  validateStep2,
  isFileAllowedForCategory,
  getDigitalCategorySpec,
  type AddProductFormData,
} from './addProductFormUtils';

const make = (overrides: Partial<AddProductFormData> = {}): AddProductFormData => ({
  ...formDataDefaults,
  ...overrides,
});

const noDigital = { path: '', name: '', size: null };

describe('hasServiceCoordinates', () => {
  it('is false for null profile, missing coords, and the 0/0 null-island', () => {
    expect(hasServiceCoordinates(null)).toBe(false);
    expect(hasServiceCoordinates({})).toBe(false);
    expect(hasServiceCoordinates({ latitude: null, longitude: null })).toBe(false);
    expect(hasServiceCoordinates({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('is true for real coordinates', () => {
    expect(hasServiceCoordinates({ latitude: -1.2921, longitude: 36.8219 })).toBe(true);
  });
});

describe('validateStep1', () => {
  it('requires a name and a photo for a physical product', () => {
    const errors = validateStep1(make({ name: '', product_type: 'physical' }), true, false);
    expect(errors.name).toBeTruthy();
    expect(errors.image).toBeTruthy();
  });

  it('passes for a named physical product with a photo', () => {
    const errors = validateStep1(make({ product_type: 'physical', name: 'Watch' }), true, true);
    expect(errors).toEqual({});
  });

  it('passes for a digital product with a name, photo, and digital_category', () => {
    const errors = validateStep1(make({ product_type: 'digital', digital_category: 'audio', name: 'Podcast' }), false, true);
    expect(errors).toEqual({});
  });

  it('blocks a service when the shop has no coordinates', () => {
    const errors = validateStep1(make({ product_type: 'service', name: 'Haircut' }), false, true);
    expect(errors.product_type).toBeTruthy();
  });

  it('allows a service once coordinates exist', () => {
    const errors = validateStep1(make({ product_type: 'service', name: 'Haircut' }), true, true);
    expect(errors).toEqual({});
  });
});

describe('validateStep2', () => {
  it('requires a description and a price at or above the minimum', () => {
    const errors = validateStep2(make({ description: '', price: '10' }));
    expect(errors.description).toBeTruthy();
    expect(errors.price).toBeTruthy();
  });

  it('passes for a plain physical product priced at the floor', () => {
    expect(validateStep2(make({ description: 'A nice watch', price: '50' }))).toEqual({});
  });

  it('passes for a digital and a service product with valid price + description', () => {
    expect(validateStep2(make({ product_type: 'digital', description: 'PDF guide', price: '200', digital_file_path: '/files/guide.pdf' }))).toEqual({});
    expect(validateStep2(make({ product_type: 'service', description: 'One session', price: '1500' }))).toEqual({});
  });

  it('requires a digital file for digital products when missing', () => {
    const errors = validateStep2(make({ product_type: 'digital', description: 'Guide', price: '200' }));
    expect(errors.digital_file).toBe('Upload a digital file.');
  });

  it('enforces audio category extensions (.mp3, .wav, etc.) and rejects video/document formats', () => {
    const badFile = new File(['data'], 'tutorial.mp4', { type: 'video/mp4' });
    const errors = validateStep2(make({
      product_type: 'digital',
      digital_category: 'audio',
      description: 'Audio lesson',
      price: '500',
      digital_file: badFile,
    }));
    expect(errors.digital_file).toContain('Invalid file format for Audio');

    const goodFile = new File(['data'], 'episode1.mp3', { type: 'audio/mpeg' });
    const ok = validateStep2(make({
      product_type: 'digital',
      digital_category: 'audio',
      description: 'Audio lesson',
      price: '500',
      digital_file: goodFile,
    }));
    expect(ok.digital_file).toBeUndefined();
  });

  it('enforces video category extensions (.mp4, .mov, etc.) and rejects audio/document formats', () => {
    const badFile = new File(['data'], 'notes.pdf', { type: 'application/pdf' });
    const errors = validateStep2(make({
      product_type: 'digital',
      digital_category: 'video',
      description: 'Masterclass video',
      price: '1000',
      digital_file: badFile,
    }));
    expect(errors.digital_file).toContain('Invalid file format for Video');

    const goodFile = new File(['data'], 'lesson.mp4', { type: 'video/mp4' });
    const ok = validateStep2(make({
      product_type: 'digital',
      digital_category: 'video',
      description: 'Masterclass video',
      price: '1000',
      digital_file: goodFile,
    }));
    expect(ok.digital_file).toBeUndefined();
  });

  it('enforces document category extensions (.pdf, .epub, .zip, etc.) and rejects audio/video formats', () => {
    const badFile = new File(['data'], 'beat.wav', { type: 'audio/wav' });
    const errors = validateStep2(make({
      product_type: 'digital',
      digital_category: 'document',
      description: 'Ebook',
      price: '300',
      digital_file: badFile,
    }));
    expect(errors.digital_file).toContain('Invalid file format for Document');

    const goodFile = new File(['data'], 'ebook.pdf', { type: 'application/pdf' });
    const ok = validateStep2(make({
      product_type: 'digital',
      digital_category: 'document',
      description: 'Ebook',
      price: '300',
      digital_file: goodFile,
    }));
    expect(ok.digital_file).toBeUndefined();
  });

  it('enforces production days (1-5) and a prompt for custom physical products', () => {
    const bad = validateStep2(make({
      description: 'Custom', price: '500', is_custom_product: true,
      production_days: '9', customization_prompt: '   ',
    }));
    expect(bad.production_days).toBeTruthy();
    expect(bad.customization_prompt).toBeTruthy();

    const ok = validateStep2(make({
      description: 'Custom', price: '500', is_custom_product: true,
      production_days: '3', customization_prompt: 'What name to engrave?',
    }));
    expect(ok).toEqual({});
  });

  it('enforces the allowed import windows for imported physical products', () => {
    expect(validateStep2(make({ description: 'x', price: '500', is_imported_product: true, import_days: '10' })).import_days).toBeTruthy();
    expect(validateStep2(make({ description: 'x', price: '500', is_imported_product: true, import_days: '14' }))).toEqual({});
  });

  it('ignores custom/imported rules for non-physical types', () => {
    const errors = validateStep2(make({
      product_type: 'service', description: 'Session', price: '1500',
      is_custom_product: true, production_days: '99',
    }));
    expect(errors).toEqual({});
  });
});

describe('isFileAllowedForCategory', () => {
  it('correctly maps extensions to categories', () => {
    expect(isFileAllowedForCategory('track.mp3', 'audio')).toBe(true);
    expect(isFileAllowedForCategory('track.wav', 'audio')).toBe(true);
    expect(isFileAllowedForCategory('track.mp4', 'audio')).toBe(false);

    expect(isFileAllowedForCategory('video.mp4', 'video')).toBe(true);
    expect(isFileAllowedForCategory('video.mov', 'video')).toBe(true);
    expect(isFileAllowedForCategory('video.pdf', 'video')).toBe(false);

    expect(isFileAllowedForCategory('book.pdf', 'document')).toBe(true);
    expect(isFileAllowedForCategory('pack.zip', 'document')).toBe(true);
    expect(isFileAllowedForCategory('book.mp3', 'document')).toBe(false);
  });
});

describe('getDigitalCategorySpec', () => {
  it('returns valid spec for audio, video, document', () => {
    expect(getDigitalCategorySpec('audio').id).toBe('audio');
    expect(getDigitalCategorySpec('video').id).toBe('video');
    expect(getDigitalCategorySpec('document').id).toBe('document');
  });

  it('falls back to document for unknown categories', () => {
    // @ts-expect-error testing fallback
    expect(getDigitalCategorySpec('unknown').id).toBe('document');
  });
});

describe('buildProductData', () => {
  it('builds a plain physical payload and nulls type-specific fields', () => {
    const data = buildProductData(
      make({ name: 'Watch', price: '4500', description: 'Nice', product_type: 'physical', image_url: 'main.jpg' }),
      'seller-1',
      ['extra1.jpg'],
      noDigital,
    );
    expect(data).toMatchObject({
      name: 'Watch', price: 4500, product_type: 'physical', is_digital: false,
      sellerId: 'seller-1', image_url: 'main.jpg', images: ['extra1.jpg'],
      is_custom_product: false, production_days: null, customization_prompt: null,
      is_imported_product: false, import_days: null, import_note: null,
      service_options: undefined,
      digital_category: null,
    });
  });

  it('carries custom-product fields as parsed numbers/strings', () => {
    const data = buildProductData(
      make({ name: 'Mug', price: '800', description: 'x', product_type: 'physical', is_custom_product: true, production_days: '4', customization_prompt: 'Text?' }),
      'seller-1', [], noDigital,
    );
    expect(data.is_custom_product).toBe(true);
    expect(data.production_days).toBe(4);
    expect(data.customization_prompt).toBe('Text?');
    expect(data.is_imported_product).toBe(false);
  });

  it('carries imported-product fields', () => {
    const data = buildProductData(
      make({ name: 'Bag', price: '3000', description: 'x', product_type: 'physical', is_imported_product: true, import_days: '21' }),
      'seller-1', [], noDigital,
    );
    expect(data.is_imported_product).toBe(true);
    expect(data.import_days).toBe(21);
    expect(data.import_note).toBeTruthy();
  });

  it('marks digital products and attaches the uploaded file details and digital_category', () => {
    const data = buildProductData(
      make({ name: 'Beat Pack', price: '999', description: 'x', product_type: 'digital', digital_category: 'audio' }),
      'seller-1', [],
      { path: '/uploads/beat.mp3', name: 'beat.mp3', size: 12345 },
    );
    expect(data.is_digital).toBe(true);
    expect(data.product_type).toBe('digital');
    expect(data.digital_category).toBe('audio');
    expect(data.digital_file_path).toBe('/uploads/beat.mp3');
    expect(data.digital_file_name).toBe('beat.mp3');
    expect(data.digital_file_size).toBe(12345);
    expect(data.service_options).toBeUndefined();
  });

  it('attaches service_options only for services', () => {
    const service = buildProductData(
      make({ name: 'Cut', price: '1500', description: 'x', product_type: 'service' }),
      'seller-1', [], noDigital,
    );
    expect(service.service_options).toEqual(formDataDefaults.service_options);
    expect(service.is_digital).toBe(false);
  });
});
