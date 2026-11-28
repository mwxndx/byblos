import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductUpdateCustomFields } from '../src/domains/commerce/products/productValidationRules.js';
import { derivePreHandoffSla } from '../src/domains/payments/payments/productCheckoutValidation.js';

test('resolveProductUpdateCustomFields allows optional/empty customization_prompt for custom products', () => {
  const existing = {
    product_type: 'physical',
    is_custom_product: true,
    production_days: 3,
    customization_prompt: 'Old prompt',
  };

  const cleared = resolveProductUpdateCustomFields(existing, {
    is_custom_product: true,
    production_days: 4,
    customization_prompt: '   ',
  });
  assert.equal(cleared.is_custom_product, true);
  assert.equal(cleared.production_days, 4);
  assert.equal(cleared.customization_prompt, null);

  const omittedOnNew = resolveProductUpdateCustomFields(
    { product_type: 'physical', is_custom_product: false },
    { is_custom_product: true, production_days: 2 }
  );
  assert.equal(omittedOnNew.production_days, 2);
  assert.equal(omittedOnNew.customization_prompt, null);
});

test('derivePreHandoffSla does not require buyer instructions when custom product has no prompt', () => {
  const sla = derivePreHandoffSla(
    {
      isCustom: true,
      isImported: false,
      product: { id: 10, production_days: 3, customization_prompt: null },
    },
    {}
  );
  assert.equal(sla.type, 'custom_production');
  assert.equal(sla.production_days, 3);
  assert.equal(sla.customization_prompt, null);
  assert.equal(sla.buyer_instructions, null);
});

test('derivePreHandoffSla still requires buyer instructions when custom product has a prompt', () => {
  assert.throws(
    () =>
      derivePreHandoffSla(
        {
          isCustom: true,
          isImported: false,
          product: { id: 10, production_days: 3, customization_prompt: 'What size?' },
        },
        {}
      ),
    /Customization instructions are required/
  );
});

