/**
 * Unit tests for ThemesService.deleteTheme / restoreTheme.
 */
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ThemesService } from './themes.service';

function makePrismaMock() {
  return {
    storeTheme: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

const TENANT = 'tenant-themes';
const ID = 'theme-1';

const baseTheme = {
  id: ID,
  tenantId: TENANT,
  slug: 'modern',
  name: 'Modern',
  isActive: false,
  isCustom: true,
  isPreset: false,
  deletedAt: null,
};

describe('ThemesService — soft delete + restore', () => {
  let service: ThemesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef = await Test.createTestingModule({ providers: [ThemesService] })
      .overrideProvider(ThemesService)
      .useFactory({ factory: () => new ThemesService(prisma as any) })
      .compile();
    service = moduleRef.get(ThemesService);
  });

  describe('deleteTheme()', () => {
    it('soft deletes a custom inactive theme by setting deletedAt', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue(baseTheme);
      const result = await service.deleteTheme(ID, TENANT);

      expect(prisma.storeTheme.updateMany).toHaveBeenCalledWith({
        where: { id: ID, tenantId: TENANT },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.storeTheme.delete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeTruthy();
    });

    it('refuses preset themes', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue({ ...baseTheme, isPreset: true });
      await expect(service.deleteTheme(ID, TENANT)).rejects.toThrow(BadRequestException);
      expect(prisma.storeTheme.updateMany).not.toHaveBeenCalled();
    });

    it('refuses active themes', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue({ ...baseTheme, isActive: true });
      await expect(service.deleteTheme(ID, TENANT)).rejects.toThrow(BadRequestException);
      expect(prisma.storeTheme.updateMany).not.toHaveBeenCalled();
    });

    it('404s when theme is missing or already deleted', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue(null);
      await expect(service.deleteTheme(ID, TENANT)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreTheme()', () => {
    it('clears deletedAt for a soft-deleted theme', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue({ ...baseTheme, deletedAt: new Date('2026-01-01') });
      const result = await service.restoreTheme(ID, TENANT);

      expect(prisma.storeTheme.updateMany).toHaveBeenCalledWith({
        where: { id: ID, tenantId: TENANT },
        data: { deletedAt: null },
      });
      expect(result.success).toBe(true);
    });

    it('is idempotent — non-deleted theme returns alreadyActive', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue(baseTheme);
      const result = await service.restoreTheme(ID, TENANT);
      expect(result.success).toBe(true);
      expect((result as any).alreadyActive).toBe(true);
      expect(prisma.storeTheme.updateMany).not.toHaveBeenCalled();
    });

    it('404s when theme does not exist', async () => {
      prisma.storeTheme.findFirst.mockResolvedValue(null);
      await expect(service.restoreTheme(ID, TENANT)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThemes() / getActiveTheme() exclude soft-deleted', () => {
    it('getThemes filters deletedAt:null', async () => {
      await service.getThemes(TENANT);
      expect(prisma.storeTheme.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        deletedAt: null,
      });
    });
  });
});
