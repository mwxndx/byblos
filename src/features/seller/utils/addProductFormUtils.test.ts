import { describe, it, expect } from 'vitest';
import {
  formDataDefaults,
  hasServiceCoordinates,
  validateStep1,
  validateStep2,
  buildProductData,
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
    expect(hasServiceCoordinates({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('is true for real coordinates', () => {
    expect(hasServiceCoordinates({ latitude: -1.29, longitude: 36.82 })).toBe(true);
  });
});

describe('validateStep1', () => {
  it('requires a name and a photo for a physical product', () => {
    const errors = validateStep1(make({ product_type: 'physical', name: '' }), true, false);
    expect(errors.name).toBeTruthy();
    expect(errors.image).toBeTruthy();
  });

  it('passes for a named physical product with a photo', () => {
    const errors = validateStep1(make({ product_type: 'physical', name: 'Watch' }), true, true);
    expect(errors).toEqual({});
  });

  it('passes for a digital product with a name and photo (no coords needed)', () => {
    const errors = validateStep1(make({ product_type: 'digital', name: 'Ebook' }), false, true);
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
    expect(validateStep2(make({ product_type: 'digital', description: 'PDF guide', price: '200' }))).toEqual({});
    expect(validateStep2(make({ product_type: 'service', description: 'One session', price: '1500' }))).toEqual({});
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

  it('marks digital products and attaches the uploaded file details', () => {
    const data = buildProductData(
      make({ name: 'Preset', price: '999', description: 'x', product_type: 'digital' }),
      'seller-1', [],
      { path: '/uploads/preset.zip', name: 'preset.zip', size: 12345 },
    );
    expect(data.is_digital).toBe(true);
    expect(data.product_type).toBe('digital');
    expect(data.digital_file_path).toBe('/uploads/preset.zip');
    expect(data.digital_file_name).toBe('preset.zip');
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
