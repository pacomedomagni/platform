import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async setup() {
    // Create Tenant A
    const tA = await this.prisma.tenant.upsert({
      where: { domain: 'tenant-a.com' },
      update: {},
      create: { name: 'Tenant A', domain: 'tenant-a.com' },
    });
    // Create Tenant B
    const tB = await this.prisma.tenant.upsert({
      where: { domain: 'tenant-b.com' },
      update: {},
      create: { name: 'Tenant B', domain: 'tenant-b.com' },
    });
    return { tA, tB };
  }

  async createUser(email: string, tenantId: string) {
    // We try to insert. 
    // Prerequisite: The RLS Session Config MUST be set on the transaction or connection.
    // Since we don't have the "Automatic Middleware" yet that sets it in the DB,
    // We must manually set it here for Phase 1 verification.
    
    // NOTE: This logic mimics what our future Prisma Extension will do automatically.
    
    const sessionTenantId = this.cls.get('tenantId');
    if (!sessionTenantId) throw new Error('No Tenant Context in Code!');

    return await this.prisma.$transaction(async (tx) => {
      // 1. Set the RLS variable
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant', '${sessionTenantId}', true)`);
      
      // 2. Perform operation
      return await tx.user.create({
        data: {
          email,
          tenantId: tenantId, // This must match sessionTenantId or RLS fails
        },
      });
    });
  }

  async getUsers() {
    const sessionTenantId = this.cls.get('tenantId');
    
    return await this.prisma.$transaction(async (tx) => {
      // 1. Set the RLS variable
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant', '${sessionTenantId}', true)`);
      
      // 2. Perform operation
      return await tx.user.findMany();
    });
  }
}
