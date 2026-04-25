/**
 * Unit tests for ReviewsService.deleteReview / restoreReview.
 *
 * Covers:
 *  - delete sets deletedAt + recomputes product rating stats (excluding deleted)
 *  - delete refuses already-deleted reviews (404)
 *  - restore clears deletedAt + recomputes product rating stats
 *  - restore is idempotent for non-deleted reviews
 *  - restore 404s for unknown IDs
 *  - admin list excludes soft-deleted by default; status='deleted' returns only soft-deleted
 *
 * Prisma is fully mocked so this runs in milliseconds with no DB dependency.
 */
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function makePrismaMock() {
  return {
    productReview: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 0 }, _count: 0 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    productListing: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

const TENANT = 'tenant-soft';
const REVIEW_ID = 'review-1';
const PRODUCT_ID = 'product-1';

const baseReview = {
  id: REVIEW_ID,
  tenantId: TENANT,
  productListingId: PRODUCT_ID,
  status: 'approved',
  rating: 5,
  deletedAt: null,
};

describe('ReviewsService — soft delete + restore', () => {
  let service: ReviewsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef = await Test.createTestingModule({ providers: [ReviewsService] })
      .overrideProvider(ReviewsService)
      .useFactory({ factory: () => new ReviewsService(prisma as any) })
      .compile();
    service = moduleRef.get(ReviewsService);
  });

  describe('deleteReview()', () => {
    it('sets deletedAt and recomputes product rating stats', async () => {
      prisma.productReview.findFirst.mockResolvedValue(baseReview);
      prisma.productReview.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteReview(TENANT, REVIEW_ID);

      expect(prisma.productReview.updateMany).toHaveBeenCalledWith({
        where: { id: REVIEW_ID, tenantId: TENANT },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.productReview.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeTruthy();
    });

    it('refuses already-deleted reviews with 404', async () => {
      prisma.productReview.findFirst.mockResolvedValue(null); // findFirst filters deletedAt:null
      await expect(service.deleteReview(TENANT, REVIEW_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreReview()', () => {
    it('clears deletedAt and recomputes stats', async () => {
      prisma.productReview.findFirst.mockResolvedValue({ ...baseReview, deletedAt: new Date('2026-01-01') });
      prisma.productReview.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.restoreReview(TENANT, REVIEW_ID);

      expect(prisma.productReview.updateMany).toHaveBeenCalledWith({
        where: { id: REVIEW_ID, tenantId: TENANT },
        data: { deletedAt: null },
      });
      expect(prisma.productReview.aggregate).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('is idempotent — non-deleted reviews return alreadyActive', async () => {
      prisma.productReview.findFirst.mockResolvedValue(baseReview);
      const result = await service.restoreReview(TENANT, REVIEW_ID);
      expect(result.success).toBe(true);
      expect((result as any).alreadyActive).toBe(true);
      expect(prisma.productReview.updateMany).not.toHaveBeenCalled();
    });

    it('throws 404 when review does not exist', async () => {
      prisma.productReview.findFirst.mockResolvedValue(null);
      await expect(service.restoreReview(TENANT, REVIEW_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listReviewsAdmin() filter', () => {
    it('excludes soft-deleted by default', async () => {
      prisma.productReview.findMany.mockResolvedValue([]);
      prisma.productReview.count.mockResolvedValue(0);
      await service.listReviewsAdmin(TENANT, {});
      expect(prisma.productReview.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        deletedAt: null,
      });
    });

    it('returns only soft-deleted when status=deleted', async () => {
      prisma.productReview.findMany.mockResolvedValue([]);
      prisma.productReview.count.mockResolvedValue(0);
      await service.listReviewsAdmin(TENANT, { status: 'deleted' });
      expect(prisma.productReview.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        deletedAt: { not: null },
      });
    });

    it('combines status filter with deletedAt:null', async () => {
      prisma.productReview.findMany.mockResolvedValue([]);
      prisma.productReview.count.mockResolvedValue(0);
      await service.listReviewsAdmin(TENANT, { status: 'pending' });
      expect(prisma.productReview.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        status: 'pending',
        deletedAt: null,
      });
    });
  });
});
