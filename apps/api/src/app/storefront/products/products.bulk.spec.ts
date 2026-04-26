/**
 * Unit tests for the products bulk endpoints.
 *
 * Covers:
 *  - bulkSetPublished: scoped to tenant via the WHERE clause; cross-tenant ids no-op silently
 *  - bulkDelete: soft-delete via deletedAt; webhooks fired per row
 *  - empty/invalid ids return zero counts without hitting the DB
 *  - hard cap on batch size enforced at controller (covered separately)
 */
import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';

function makePrismaMock() {
  return {
    productListing: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function makeWebhookMock() {
  return { triggerEvent: jest.fn().mockResolvedValue(undefined) };
}

function makeAuditMock() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

const TENANT = 'tenant-bulk';
const ACTOR = 'user-actor-1';

describe('ProductsService — bulk', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let webhook: ReturnType<typeof makeWebhookMock>;
  let audit: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    webhook = makeWebhookMock();
    audit = makeAuditMock();
    const moduleRef = await Test.createTestingModule({ providers: [ProductsService] })
      .overrideProvider(ProductsService)
      .useFactory({
        factory: () => new ProductsService(prisma as any, webhook as any, audit as any),
      })
      .compile();
    service = moduleRef.get(ProductsService);
  });

  describe('bulkSetPublished', () => {
    it('returns zero counts for empty ids without hitting the DB', async () => {
      const result = await service.bulkSetPublished(TENANT, [], true);
      expect(result).toEqual({ ok: 0, failed: 0, ids: [] });
      expect(prisma.productListing.findMany).not.toHaveBeenCalled();
      expect(prisma.productListing.updateMany).not.toHaveBeenCalled();
    });

    it('only updates ids that match the tenant + are not deleted', async () => {
      // Caller asks for 3 ids; only 2 belong to this tenant.
      prisma.productListing.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p3' }]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkSetPublished(TENANT, ['p1', 'p2-wrong-tenant', 'p3'], true);

      expect(prisma.productListing.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2-wrong-tenant', 'p3'] }, tenantId: TENANT, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.productListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p3'] }, tenantId: TENANT, deletedAt: null },
        data: { isPublished: true },
      });
      expect(result.ok).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.ids).toEqual(['p1', 'p3']);
    });

    it('passes isPublished=false through when unpublishing', async () => {
      prisma.productListing.findMany.mockResolvedValue([{ id: 'p1' }]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 1 });
      await service.bulkSetPublished(TENANT, ['p1'], false);
      expect(prisma.productListing.updateMany.mock.calls[0][0].data).toEqual({ isPublished: false });
    });

    it('writes one summary audit entry on publish (not per row)', async () => {
      prisma.productListing.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p3' }]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 2 });
      await service.bulkSetPublished(TENANT, ['p1', 'p2-other', 'p3'], true, ACTOR);
      expect(audit.log).toHaveBeenCalledTimes(1);
      const [actor, payload] = audit.log.mock.calls[0];
      expect(actor).toEqual({ tenantId: TENANT, userId: ACTOR });
      expect(payload).toMatchObject({
        action: 'products.bulk_published',
        docType: 'ProductListing',
        docName: 'bulk',
        meta: { requestedCount: 3, affectedCount: 2, skippedCount: 1, ids: ['p1', 'p3'] },
      });
    });

    it('uses bulk_unpublished action when unpublishing', async () => {
      prisma.productListing.findMany.mockResolvedValue([{ id: 'p1' }]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 1 });
      await service.bulkSetPublished(TENANT, ['p1'], false, ACTOR);
      expect(audit.log.mock.calls[0][1].action).toBe('products.bulk_unpublished');
    });

    it('does not write audit when zero rows affected', async () => {
      prisma.productListing.findMany.mockResolvedValue([]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 0 });
      await service.bulkSetPublished(TENANT, ['p-other'], true, ACTOR);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('bulkDelete', () => {
    it('soft-deletes by setting deletedAt + isPublished:false', async () => {
      prisma.productListing.findMany.mockResolvedValue([
        { id: 'p1', slug: 'a', displayName: 'A' },
        { id: 'p2', slug: 'b', displayName: 'B' },
      ]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkDelete(TENANT, ['p1', 'p2', 'p3-other-tenant']);

      expect(prisma.productListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] }, tenantId: TENANT, deletedAt: null },
        data: { isPublished: false, deletedAt: expect.any(Date) },
      });
      expect(result.ok).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('fires one webhook per soft-deleted product', async () => {
      prisma.productListing.findMany.mockResolvedValue([
        { id: 'p1', slug: 'a', displayName: 'A' },
        { id: 'p2', slug: 'b', displayName: 'B' },
      ]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 2 });

      await service.bulkDelete(TENANT, ['p1', 'p2']);
      // Allow microtask queue to drain (webhooks are .catch()'d but not awaited)
      await new Promise((resolve) => setImmediate(resolve));

      expect(webhook.triggerEvent).toHaveBeenCalledTimes(2);
      const events = webhook.triggerEvent.mock.calls.map((c) => c[1].event);
      expect(events).toEqual(['product.deleted', 'product.deleted']);
    });

    it('returns zero counts for empty ids', async () => {
      const result = await service.bulkDelete(TENANT, []);
      expect(result).toEqual({ ok: 0, failed: 0, ids: [] });
      expect(prisma.productListing.updateMany).not.toHaveBeenCalled();
    });

    it('writes one summary audit entry on delete (not per row)', async () => {
      prisma.productListing.findMany.mockResolvedValue([
        { id: 'p1', slug: 'a', displayName: 'A' },
        { id: 'p2', slug: 'b', displayName: 'B' },
      ]);
      prisma.productListing.updateMany.mockResolvedValue({ count: 2 });
      await service.bulkDelete(TENANT, ['p1', 'p2', 'p3-other'], ACTOR);
      expect(audit.log).toHaveBeenCalledTimes(1);
      const [actor, payload] = audit.log.mock.calls[0];
      expect(actor).toEqual({ tenantId: TENANT, userId: ACTOR });
      expect(payload).toMatchObject({
        action: 'products.bulk_deleted',
        docType: 'ProductListing',
        docName: 'bulk',
      });
      expect(payload.meta).toMatchObject({ requestedCount: 3, affectedCount: 2, skippedCount: 1 });
      expect(payload.meta.items).toEqual([
        { id: 'p1', slug: 'a', displayName: 'A' },
        { id: 'p2', slug: 'b', displayName: 'B' },
      ]);
    });
  });
});
