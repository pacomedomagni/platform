import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { DEFAULT_CHART_OF_ACCOUNTS } from './defaults/chart-of-accounts';
import { DEFAULT_WAREHOUSE_CONFIG } from './defaults/warehouse';
import { DEFAULT_UOMS } from './defaults/uoms';
import { DEFAULT_DOC_TYPES } from './defaults/doc-types';

@Injectable()
export class SeedDataService {
  private readonly logger = new Logger(SeedDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed Chart of Accounts for a tenant
   */
  async seedAccounts(tenantId: string): Promise<void> {
    this.logger.debug(`Seeding accounts for tenant ${tenantId}`);

    const accounts = DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
      tenantId,
      code: account.code,
      name: account.name,
      rootType: account.rootType,
      accountType: account.accountType,
      isGroup: account.isGroup || false,
      parentAccountCode: account.parentAccountCode || null,
      isActive: true,
    }));

    // Insert accounts in order (parents first)
    for (const account of accounts) {
      await this.prisma.account.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: account.code,
          },
        },
        create: account,
        update: {},
      });
    }

    this.logger.debug(`Seeded ${accounts.length} accounts for tenant ${tenantId}`);
  }

  /**
   * Seed default warehouse with locations
   */
  async seedWarehouse(tenantId: string): Promise<void> {
    this.logger.debug(`Seeding warehouse for tenant ${tenantId}`);

    const { warehouse: whConfig, locations } = DEFAULT_WAREHOUSE_CONFIG;

    // Create warehouse
    const warehouse = await this.prisma.warehouse.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: whConfig.code,
        },
      },
      create: {
        tenantId,
        code: whConfig.code,
        name: whConfig.name,
        isActive: true,
      },
      update: {},
    });

    // Create locations
    const createdLocations: Record<string, string> = {};

    for (const loc of locations) {
      const parentId = loc.parentCode ? createdLocations[loc.parentCode] : null;

      const location = await this.prisma.location.upsert({
        where: {
          tenantId_warehouseId_code: {
            tenantId,
            warehouseId: warehouse.id,
            code: loc.code,
          },
        },
        create: {
          tenantId,
          warehouseId: warehouse.id,
          code: loc.code,
          name: loc.name,
          path: loc.path,
          parentId,
          isPickable: loc.isPickable ?? true,
          isPutaway: loc.isPutaway ?? true,
          isStaging: loc.isStaging ?? false,
          isActive: true,
        },
        update: {},
      });

      createdLocations[loc.code] = location.id;
    }

    // Update warehouse with default locations
    const receivingLocation = createdLocations['RECEIVING'];
    const pickingLocation = createdLocations['ROOT'];

    if (receivingLocation || pickingLocation) {
      await this.prisma.warehouse.update({
        where: { id: warehouse.id },
        data: {
          defaultReceivingLocationId: receivingLocation,
          defaultPickingLocationId: pickingLocation,
        },
      });
    }

    this.logger.debug(`Seeded warehouse with ${locations.length} locations for tenant ${tenantId}`);
  }

  /**
   * Seed Units of Measure (global, not tenant-specific)
   */
  async seedUoms(): Promise<void> {
    this.logger.debug('Seeding UOMs');

    for (const uom of DEFAULT_UOMS) {
      await this.prisma.uom.upsert({
        where: { code: uom.code },
        create: {
          code: uom.code,
          name: uom.name,
          isActive: true,
        },
        update: {},
      });
    }

    this.logger.debug(`Seeded ${DEFAULT_UOMS.length} UOMs`);
  }

  /**
   * Seed default DocTypes and permissions
   */
  async seedDefaults(tenantId: string): Promise<void> {
    this.logger.debug(`Seeding defaults for tenant ${tenantId}`);

    // Seed DocTypes (global)
    for (const docType of DEFAULT_DOC_TYPES) {
      await this.prisma.docType.upsert({
        where: { name: docType.name },
        create: {
          name: docType.name,
          module: docType.module,
          isSingle: docType.isSingle || false,
          isChild: docType.isChild || false,
          description: docType.description,
        },
        update: {},
      });

      // Seed default permissions
      for (const perm of docType.permissions || []) {
        await this.prisma.docPerm.upsert({
          where: {
            id: `${docType.name}-${perm.role}`, // Deterministic ID
          },
          create: {
            id: `${docType.name}-${perm.role}`,
            docTypeName: docType.name,
            role: perm.role,
            read: perm.read ?? true,
            write: perm.write ?? false,
            create: perm.create ?? false,
            delete: perm.delete ?? false,
            submit: perm.submit ?? false,
            cancel: perm.cancel ?? false,
            amend: perm.amend ?? false,
            report: perm.report ?? false,
          },
          update: {},
        });
      }
    }

    // Create an initial audit log entry
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'CREATE',
        docType: 'Tenant',
        docName: tenantId,
        meta: { event: 'tenant_provisioned', timestamp: new Date().toISOString() },
      },
    });

    this.logger.debug(`Seeded defaults for tenant ${tenantId}`);
  }
}
