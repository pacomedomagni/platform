/**
 * Unit tests for AdminCustomersService.bulkSetActive — verifies the WHERE
 * clause is tenant-scoped (no cross-tenant leakage), the count returned by
 * Prisma is reflected in ok/failed accurately, and that deactivation also
 * bumps tokenVersion (revoking all JWTs for the affected customers).
 */
import { Test } from '@nestjs/testing';
import { AdminCustomersService } from './admin-customers.service';

function makePrismaMock() {
  return {
    storeCustomer: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function makeAuditMock() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

const TENANT = 'tenant-bulk-c';
const ACTOR = 'user-actor-c';

describe('AdminCustomersService — bulkSetActive', () => {
  let service: AdminCustomersService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let audit: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    audit = makeAuditMock();
    const moduleRef = await Test.createTestingModule({ providers: [AdminCustomersService] })
      .overrideProvider(AdminCustomersService)
      .useFactory({ factory: () => new AdminCustomersService(prisma as any, audit as any) })
      .compile();
    service = moduleRef.get(AdminCustomersService);
  });

  it('returns zero counts and skips DB when ids is empty', async () => {
    const result = await service.bulkSetActive(TENANT, [], false);
    expect(result).toEqual({ ok: 0, failed: 0, ids: [] });
    expect(prisma.storeCustomer.findMany).not.toHaveBeenCalled();
    expect(prisma.storeCustomer.updateMany).not.toHaveBeenCalled();
  });

  it('only mutates ids that belong to the requested tenant', async () => {
    prisma.storeCustomer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c3' }]);
    prisma.storeCustomer.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.bulkSetActive(TENANT, ['c1', 'c2-other-tenant', 'c3'], false);

    expect(prisma.storeCustomer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2-other-tenant', 'c3'] }, tenantId: TENANT },
      select: { id: true },
    });
    expect(prisma.storeCustomer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c3'] }, tenantId: TENANT },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    expect(result).toEqual({ ok: 2, failed: 1, ids: ['c1', 'c3'] });
  });

  it('on activate, does NOT bump tokenVersion (only deactivation revokes tokens)', async () => {
    prisma.storeCustomer.findMany.mockResolvedValue([{ id: 'c1' }]);
    prisma.storeCustomer.updateMany.mockResolvedValue({ count: 1 });

    await service.bulkSetActive(TENANT, ['c1'], true);
    expect(prisma.storeCustomer.updateMany.mock.calls[0][0].data).toEqual({ isActive: true });
  });

  it('writes one summary audit entry on deactivate (not per row)', async () => {
    prisma.storeCustomer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c3' }]);
    prisma.storeCustomer.updateMany.mockResolvedValue({ count: 2 });

    await service.bulkSetActive(TENANT, ['c1', 'c2-other', 'c3'], false, ACTOR);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [actor, payload] = audit.log.mock.calls[0];
    expect(actor).toEqual({ tenantId: TENANT, userId: ACTOR });
    expect(payload).toMatchObject({
      action: 'customers.bulk_deactivated',
      docType: 'StoreCustomer',
      docName: 'bulk',
      meta: { requestedCount: 3, affectedCount: 2, skippedCount: 1, ids: ['c1', 'c3'] },
    });
  });

  it('uses bulk_activated action when activating', async () => {
    prisma.storeCustomer.findMany.mockResolvedValue([{ id: 'c1' }]);
    prisma.storeCustomer.updateMany.mockResolvedValue({ count: 1 });
    await service.bulkSetActive(TENANT, ['c1'], true, ACTOR);
    expect(audit.log.mock.calls[0][1].action).toBe('customers.bulk_activated');
  });

  it('does not write audit when zero rows affected', async () => {
    prisma.storeCustomer.findMany.mockResolvedValue([]);
    prisma.storeCustomer.updateMany.mockResolvedValue({ count: 0 });
    await service.bulkSetActive(TENANT, ['c-other'], false, ACTOR);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
