import { DocService } from './doc.service';

describe('DocService audit logging', () => {
  const user = { id: 'user-1', tenantId: 'tenant-1', roles: ['System Manager'] };

  const buildService = (overrides: Partial<any> = {}) => {
    const prisma = {
      docType: { findUnique: jest.fn().mockResolvedValue({ name: 'Test Doc' }) },
      docField: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          $queryRawUnsafe: jest.fn().mockResolvedValue([{ name: 'DOC-1' }]),
          $executeRawUnsafe: jest.fn(),
        }),
      ),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ name: 'DOC-1', docstatus: 0 }]),
      $executeRawUnsafe: jest.fn(),
      auditLog: { create: jest.fn() },
      ...overrides,
    };

    const validationService = { validate: jest.fn() };
    const permissionService = { ensurePermission: jest.fn() };
    const hookService = { trigger: jest.fn(async (_docType: string, _hook: string, payload: any) => payload) };

    return {
      service: new DocService(prisma as any, validationService as any, permissionService as any, hookService as any),
      prisma,
    };
  };

  it('logs CREATE on create', async () => {
    const { service, prisma } = buildService();
    await service.create('Test Doc', { name: 'DOC-1' }, user);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'CREATE', docType: 'Test Doc', docName: 'DOC-1', tenantId: 'tenant-1' }),
    });
  });

  it('logs UPDATE on update', async () => {
    const { service, prisma } = buildService();
    await service.update('Test Doc', 'DOC-1', { name: 'DOC-1' }, user);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'UPDATE', docType: 'Test Doc', docName: 'DOC-1', tenantId: 'tenant-1' }),
    });
  });

  it('logs DELETE on delete', async () => {
    const { service, prisma } = buildService();
    await service.delete('Test Doc', 'DOC-1', user);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DELETE', docType: 'Test Doc', docName: 'DOC-1', tenantId: 'tenant-1' }),
    });
  });

  it('logs SUBMIT on submit', async () => {
    const { service, prisma } = buildService();
    await service.submit('Test Doc', 'DOC-1', user);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'SUBMIT', docType: 'Test Doc', docName: 'DOC-1', tenantId: 'tenant-1' }),
    });
  });

  it('logs CANCEL on cancel', async () => {
    const { service, prisma } = buildService({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ name: 'DOC-1', docstatus: 1 }]),
    });
    await service.cancel('Test Doc', 'DOC-1', user);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'CANCEL', docType: 'Test Doc', docName: 'DOC-1', tenantId: 'tenant-1' }),
    });
  });
});
