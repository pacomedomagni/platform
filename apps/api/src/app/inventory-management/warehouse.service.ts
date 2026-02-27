import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateLocationDto,
  UpdateLocationDto,
} from './inventory-management.dto';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Warehouse CRUD
  // ==========================================

  /**
   * List all active warehouses for a tenant.
   */
  async listWarehouses(ctx: TenantContext) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const warehouses = await tx.warehouse.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { locations: true } },
        },
      });

      return warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        isActive: w.isActive,
        locationCount: w._count.locations,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
    });
  }

  /**
   * Get a single warehouse with its locations.
   */
  async getWarehouse(ctx: TenantContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const warehouse = await tx.warehouse.findFirst({
        where: {
          id,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        include: {
          locations: {
            where: { deletedAt: null },
            orderBy: { path: 'asc' },
          },
        },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse not found: ${id}`);
      }

      return {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        isActive: warehouse.isActive,
        defaultReceivingLocationId: warehouse.defaultReceivingLocationId,
        defaultPickingLocationId: warehouse.defaultPickingLocationId,
        createdAt: warehouse.createdAt,
        updatedAt: warehouse.updatedAt,
        locations: warehouse.locations.map((loc) => ({
          id: loc.id,
          code: loc.code,
          name: loc.name,
          path: loc.path,
          parentId: loc.parentId,
          isPickable: loc.isPickable,
          isPutaway: loc.isPutaway,
          isStaging: loc.isStaging,
          isActive: loc.isActive,
        })),
      };
    });
  }

  /**
   * Create a new warehouse with unique code/name per tenant.
   */
  async createWarehouse(ctx: TenantContext, dto: CreateWarehouseDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      // Check unique code
      const existingByCode = await tx.warehouse.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: dto.code } },
      });
      if (existingByCode) {
        throw new ConflictException(`Warehouse code already exists: ${dto.code}`);
      }

      // Check unique name
      const existingByName = await tx.warehouse.findUnique({
        where: { tenantId_name: { tenantId: ctx.tenantId, name: dto.name } },
      });
      if (existingByName) {
        throw new ConflictException(`Warehouse name already exists: ${dto.name}`);
      }

      const warehouse = await tx.warehouse.create({
        data: {
          tenantId: ctx.tenantId,
          code: dto.code,
          name: dto.name,
          isActive: dto.isActive ?? true,
        },
      });

      this.logger.log(`Warehouse created: ${warehouse.code} (tenant: ${ctx.tenantId})`);

      return {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        isActive: warehouse.isActive,
        createdAt: warehouse.createdAt,
        updatedAt: warehouse.updatedAt,
      };
    });
  }

  /**
   * Update warehouse name and/or isActive flag.
   */
  async updateWarehouse(ctx: TenantContext, id: string, dto: UpdateWarehouseDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const warehouse = await tx.warehouse.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse not found: ${id}`);
      }

      // If changing name, ensure uniqueness
      if (dto.name && dto.name !== warehouse.name) {
        const existingByName = await tx.warehouse.findUnique({
          where: { tenantId_name: { tenantId: ctx.tenantId, name: dto.name } },
        });
        if (existingByName) {
          throw new ConflictException(`Warehouse name already exists: ${dto.name}`);
        }
      }

      const updated = await tx.warehouse.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      this.logger.log(`Warehouse updated: ${updated.code} (tenant: ${ctx.tenantId})`);

      return {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Soft-delete a warehouse. Fails if any stock exists in it.
   */
  async deleteWarehouse(ctx: TenantContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const warehouse = await tx.warehouse.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse not found: ${id}`);
      }

      // Check for existing stock balances
      const stockCount = await tx.warehouseItemBalance.count({
        where: {
          warehouseId: id,
          actualQty: { gt: 0 },
        },
      });
      if (stockCount > 0) {
        throw new BadRequestException(
          'Cannot delete warehouse with existing stock. Move or adjust all stock first.',
        );
      }

      // Soft delete the warehouse and its locations
      await tx.warehouse.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.location.updateMany({
        where: { warehouseId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Warehouse soft-deleted: ${warehouse.code} (tenant: ${ctx.tenantId})`);

      return { success: true };
    });
  }

  // ==========================================
  // Location CRUD
  // ==========================================

  /**
   * Create a location within a warehouse.
   */
  async createLocation(ctx: TenantContext, warehouseId: string, dto: CreateLocationDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      // Verify warehouse exists and belongs to tenant
      const warehouse = await tx.warehouse.findFirst({
        where: { id: warehouseId, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse not found: ${warehouseId}`);
      }

      // Check unique code within warehouse
      const existingByCode = await tx.location.findUnique({
        where: {
          tenantId_warehouseId_code: {
            tenantId: ctx.tenantId,
            warehouseId,
            code: dto.code,
          },
        },
      });
      if (existingByCode) {
        throw new ConflictException(`Location code already exists in this warehouse: ${dto.code}`);
      }

      // Resolve parent location if provided
      let parentId: string | null = null;
      let basePath = warehouse.code;
      if (dto.parentCode) {
        const parent = await tx.location.findUnique({
          where: {
            tenantId_warehouseId_code: {
              tenantId: ctx.tenantId,
              warehouseId,
              code: dto.parentCode,
            },
          },
        });
        if (!parent) {
          throw new BadRequestException(`Parent location not found: ${dto.parentCode}`);
        }
        parentId = parent.id;
        basePath = parent.path;
      }

      const path = `${basePath}/${dto.code}`;

      // Check unique path within warehouse
      const existingByPath = await tx.location.findUnique({
        where: {
          tenantId_warehouseId_path: {
            tenantId: ctx.tenantId,
            warehouseId,
            path,
          },
        },
      });
      if (existingByPath) {
        throw new ConflictException(`Location path already exists: ${path}`);
      }

      const location = await tx.location.create({
        data: {
          tenantId: ctx.tenantId,
          warehouseId,
          code: dto.code,
          name: dto.name ?? dto.code,
          path,
          parentId,
          isPickable: dto.isPickable ?? true,
          isPutaway: dto.isPutaway ?? true,
          isStaging: dto.isStaging ?? false,
        },
      });

      this.logger.log(`Location created: ${location.path} (tenant: ${ctx.tenantId})`);

      return {
        id: location.id,
        code: location.code,
        name: location.name,
        path: location.path,
        warehouseId: location.warehouseId,
        parentId: location.parentId,
        isPickable: location.isPickable,
        isPutaway: location.isPutaway,
        isStaging: location.isStaging,
        isActive: location.isActive,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
      };
    });
  }

  /**
   * Update a location's name and flags.
   */
  async updateLocation(ctx: TenantContext, id: string, dto: UpdateLocationDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const location = await tx.location.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!location) {
        throw new NotFoundException(`Location not found: ${id}`);
      }

      const updated = await tx.location.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isPickable !== undefined ? { isPickable: dto.isPickable } : {}),
          ...(dto.isPutaway !== undefined ? { isPutaway: dto.isPutaway } : {}),
          ...(dto.isStaging !== undefined ? { isStaging: dto.isStaging } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      this.logger.log(`Location updated: ${updated.path} (tenant: ${ctx.tenantId})`);

      return {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        path: updated.path,
        warehouseId: updated.warehouseId,
        parentId: updated.parentId,
        isPickable: updated.isPickable,
        isPutaway: updated.isPutaway,
        isStaging: updated.isStaging,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Soft-delete a location. Fails if any stock is held in it.
   */
  async deleteLocation(ctx: TenantContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const location = await tx.location.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!location) {
        throw new NotFoundException(`Location not found: ${id}`);
      }

      // Check for existing bin balances with stock
      const stockCount = await tx.binBalance.count({
        where: {
          locationId: id,
          actualQty: { gt: 0 },
        },
      });
      if (stockCount > 0) {
        throw new BadRequestException(
          'Cannot delete location with existing stock. Move or adjust all stock first.',
        );
      }

      await tx.location.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Location soft-deleted: ${location.path} (tenant: ${ctx.tenantId})`);

      return { success: true };
    });
  }
}
