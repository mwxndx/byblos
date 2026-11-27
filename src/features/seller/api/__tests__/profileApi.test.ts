import { describe, it, expect } from 'vitest';
import { transformSeller } from '../profileApi';

describe('transformSeller', () => {
  it('preserves isCreatorMarketplaceEnabled for camelCase and snake_case payloads', () => {
    const enabledCamel = transformSeller({
      id: 1,
      shopName: 'Eris',
      isCreatorMarketplaceEnabled: true,
    });
    expect(enabledCamel.isCreatorMarketplaceEnabled).toBe(true);

    const enabledSnake = transformSeller({
      id: 2,
      shop_name: 'Eris',
      is_creator_marketplace_enabled: true,
    });
    expect(enabledSnake.isCreatorMarketplaceEnabled).toBe(true);

    const disabled = transformSeller({
      id: 3,
      shopName: 'Eris',
      isCreatorMarketplaceEnabled: false,
    });
    expect(disabled.isCreatorMarketplaceEnabled).toBe(false);
  });
});

