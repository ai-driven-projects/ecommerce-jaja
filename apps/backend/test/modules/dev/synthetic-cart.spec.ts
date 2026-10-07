import { Result } from '@mentoria-360/shared';
import type { CartDetailDTO, CartItemInputDTO, PreviewCartQuery } from '@jaja/orders';
import { describe, expect, it } from 'vitest';
import { SyntheticCartQuery, SyntheticCartRepository } from '../../../src/modules/dev/synthetic-cart.js';

const userId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const productA = '550e8400-e29b-41d4-a716-446655440000';
const productB = '11111111-2222-4333-8444-555555555555';
const items = [
  { productId: productA, quantity: 2 },
  { productId: productB, quantity: 1 },
];

describe('SyntheticCartRepository', () => {
  it('answers a cart of the user with the items, in memory', async () => {
    const result = await new SyntheticCartRepository(items).findByUserId(userId);

    expect(result.isOk).toBe(true);
    expect(result.instance?.userId).toBe(userId);
    expect(result.instance?.items).toEqual(items);
  });

  it('stores nothing on writes', async () => {
    const repository = new SyntheticCartRepository(items);
    const cart = (await repository.findByUserId(userId)).instance!;

    expect((await repository.update(cart.clear().instance)).isOk).toBe(true);
    expect((await repository.create(cart)).isOk).toBe(true);
    expect((await repository.delete(cart.id)).isOk).toBe(true);
    expect((await repository.findById(cart.id)).errors).toEqual(['CART_NOT_FOUND']);
  });
});

describe('SyntheticCartQuery', () => {
  it('previews the items, whatever the user', async () => {
    const received: CartItemInputDTO[][] = [];
    const detail = { lines: [] } as unknown as CartDetailDTO;
    const previewCart: PreviewCartQuery = {
      execute: async (list) => {
        received.push(list);
        return Result.ok(detail);
      },
    };

    const result = await new SyntheticCartQuery(previewCart, items).execute();

    expect(result.instance).toBe(detail);
    expect(received).toEqual([items]);
  });
});
