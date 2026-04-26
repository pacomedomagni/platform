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

const TENANT = 'tenant-bulk-c';

describe('AdminCustomersService — bulkSetActive', () => {
  let service: AdminCustomersService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef = await Test.createTestingModule({ providers: [AdminCustomersService] })
      .overrideProvider(AdminCustomersService)
      .useFactory({ factory: () => new AdminCustomersService(prisma as any) })
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
});
