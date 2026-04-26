/**
 * Unit tests for CartService.setShippingEstimate.
 *
 * Verifies the endpoint:
 *   - 404s when the cart isn't found / not active / wrong tenant
 *   - rejects malformed payloads (must be object-or-null with a country)
 *   - persists the estimate as JSON + bumps lastActivityAt
 *   - accepts null to clear
 */
// uuid ships ESM-only; jest's CJS transformer chokes when CartService imports it.
// Mock it before the SUT loads so the import is satisfied without exercising real code.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

function makePrismaMock() {
  return {
    cart: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

const TENANT = 'tenant-cart';
const CART_ID = 'cart-1';

describe('CartService — setShippingEstimate', () => {
  let service: CartService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef = await Test.createTestingModule({ providers: [CartService] })
      .overrideProvider(CartService)
      .useFactory({ factory: () => new CartService(prisma as any, undefined as any) })
      .compile();
    service = moduleRef.get(CartService);
  });

  it('throws 404 when the cart is not found / not active / wrong tenant', async () => {
    prisma.cart.findFirst.mockResolvedValue(null);
    await expect(
      service.setShippingEstimate(TENANT, CART_ID, { country: 'US' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cart.update).not.toHaveBeenCalled();
  });

  it('rejects non-object payloads', async () => {
    prisma.cart.findFirst.mockResolvedValue({ id: CART_ID });
    await expect(
      service.setShippingEstimate(TENANT, CART_ID, 'string' as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.setShippingEstimate(TENANT, CART_ID, [] as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects payloads without a country', async () => {
    prisma.cart.findFirst.mockResolvedValue({ id: CART_ID });
    await expect(
      service.setShippingEstimate(TENANT, CART_ID, { rateId: 'r' } as any),
    ).rejects.toThrow(/country/i);
    await expect(
      service.setShippingEstimate(TENANT, CART_ID, { country: '' } as any),
    ).rejects.toThrow(/country/i);
  });

  it('persists a valid estimate and bumps lastActivityAt', async () => {
    prisma.cart.findFirst.mockResolvedValue({ id: CART_ID });
    const estimate = { country: 'US', state: 'CA', postalCode: '94103', rateId: 'r1', ratePrice: 9.99 };

    const result = await service.setShippingEstimate(TENANT, CART_ID, estimate);

    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: CART_ID },
      data: { shippingEstimate: estimate, lastActivityAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true, shippingEstimate: estimate });
  });

  it('accepts null to clear the estimate', async () => {
    prisma.cart.findFirst.mockResolvedValue({ id: CART_ID });
    const result = await service.setShippingEstimate(TENANT, CART_ID, null);

    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: CART_ID },
      data: { shippingEstimate: null, lastActivityAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true, shippingEstimate: null });
  });
});
