/**
 * Unit tests for ShippingService.deleteZone / restoreZone.
 */
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShippingService } from './shipping.service';

function makePrismaMock() {
  return {
    shippingZone: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
      delete: jest.fn(),
    },
    shippingRate: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

const TENANT = 'tenant-ship';
const ZONE_ID = 'zone-1';

const baseZone = {
  id: ZONE_ID,
  tenantId: TENANT,
  name: 'US Domestic',
  countries: ['US'],
  states: [],
  zipCodes: [],
  isDefault: false,
  deletedAt: null,
};

describe('ShippingService — soft delete + restore zones', () => {
  let service: ShippingService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef = await Test.createTestingModule({ providers: [ShippingService] })
      .overrideProvider(ShippingService)
      .useFactory({ factory: () => new ShippingService(prisma as any) })
      .compile();
    service = moduleRef.get(ShippingService);
  });

  describe('deleteZone()', () => {
    it('soft deletes by setting deletedAt — never calls .delete()', async () => {
      prisma.shippingZone.findFirst.mockResolvedValue(baseZone);
      const result = await service.deleteZone(TENANT, ZONE_ID);

      expect(prisma.shippingZone.updateMany).toHaveBeenCalledWith({
        where: { id: ZONE_ID, tenantId: TENANT },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.shippingZone.delete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeTruthy();
    });

    it('404s on missing/already-deleted zone', async () => {
      prisma.shippingZone.findFirst.mockResolvedValue(null);
      await expect(service.deleteZone(TENANT, ZONE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreZone()', () => {
    it('clears deletedAt for a soft-deleted zone', async () => {
      prisma.shippingZone.findFirst.mockResolvedValue({ ...baseZone, deletedAt: new Date() });
      const result = await service.restoreZone(TENANT, ZONE_ID);
      expect(prisma.shippingZone.updateMany).toHaveBeenCalledWith({
        where: { id: ZONE_ID, tenantId: TENANT },
        data: { deletedAt: null },
      });
      expect(result.success).toBe(true);
    });

    it('is idempotent — alreadyActive flag for non-deleted zone', async () => {
      prisma.shippingZone.findFirst.mockResolvedValue(baseZone);
      const result = await service.restoreZone(TENANT, ZONE_ID);
      expect(result.success).toBe(true);
      expect((result as any).alreadyActive).toBe(true);
      expect(prisma.shippingZone.updateMany).not.toHaveBeenCalled();
    });

    it('404s when zone is missing entirely', async () => {
      prisma.shippingZone.findFirst.mockResolvedValue(null);
      await expect(service.restoreZone(TENANT, ZONE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listZones() excludes soft-deleted', () => {
    it('filters deletedAt:null', async () => {
      await service.listZones(TENANT);
      expect(prisma.shippingZone.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        deletedAt: null,
      });
    });
  });
});
