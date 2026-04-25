import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma } from '@platform/db';
import { SerialStatus } from '@prisma/client';
import {
  CreateBatchDto,
  UpdateBatchDto,
  BatchQueryDto,
  CreateSerialDto,
  CreateSerialBulkDto,
  UpdateSerialDto,
  SerialQueryDto,
} from './inventory-management.dto';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

@Injectable()
export class BatchSerialService {
  private readonly logger = new Logger(BatchSerialService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Batch Management
  // ==========================================

  /**
   * Create a new batch
   */
  async createBatch(ctx: TenantContext, dto: CreateBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const item = await tx.item.findFirst({
        where: { tenantId: ctx.tenantId, code: dto.itemCode },
      });

      if (!item) {
        throw new NotFoundException(`Item not found: ${dto.itemCode}`);
      }

      if (!item.hasBatch) {
        throw new BadRequestException(`Item ${dto.itemCode} does not support batch tracking`);
      }

      const existing = await tx.batch.findFirst({
        where: { tenantId: ctx.tenantId, itemId: item.id, batchNo: dto.batchNo },
      });

      if (existing) {
        throw new BadRequestException(`Batch ${dto.batchNo} already exists for item ${dto.itemCode}`);
      }

      const batch = await tx.batch.create({
        data: {
          tenantId: ctx.tenantId,
          itemId: item.id,
          batchNo: dto.batchNo,
          mfgDate: dto.mfgDate ? new Date(dto.mfgDate) : null,
          expDate: dto.expDate ? new Date(dto.expDate) : null,
        },
        include: { item: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'create_batch',
          docType: 'Batch',
          docName: batch.batchNo,
          meta: { itemCode: dto.itemCode, batchNo: dto.batchNo },
        },
      });

      return {
        id: batch.id,
        itemCode: batch.item.code,
        itemName: batch.item.name,
        batchNo: batch.batchNo,
        mfgDate: batch.mfgDate?.toISOString().split('T')[0],
        expDate: batch.expDate?.toISOString().split('T')[0],
        isActive: batch.isActive,
        createdAt: batch.createdAt,
      };
    });
  }

  /**
   * Update a batch
   */
  async updateBatch(ctx: TenantContext, batchId: string, dto: UpdateBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const batch = await tx.batch.findFirst({
        where: { id: batchId, tenantId: ctx.tenantId },
        include: { item: true },
      });

      if (!batch) {
        throw new NotFoundException(`Batch not found`);
      }

      const beforeValues = {
        mfgDate: batch.mfgDate?.toISOString().split('T')[0] ?? null,
        expDate: batch.expDate?.toISOString().split('T')[0] ?? null,
        isActive: batch.isActive,
      };

      const updated = await tx.batch.update({
        where: { id: batchId },
        data: {
          mfgDate: dto.mfgDate !== undefined ? (dto.mfgDate ? new Date(dto.mfgDate) : null) : undefined,
          expDate: dto.expDate !== undefined ? (dto.expDate ? new Date(dto.expDate) : null) : undefined,
          isActive: dto.isActive,
        },
        include: { item: true },
      });

      const afterValues = {
        mfgDate: updated.mfgDate?.toISOString().split('T')[0] ?? null,
        expDate: updated.expDate?.toISOString().split('T')[0] ?? null,
        isActive: updated.isActive,
      };

      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'update_batch',
          docType: 'Batch',
          docName: batch.batchNo,
          meta: {
            batchId,
            itemCode: batch.item.code,
            before: beforeValues,
            after: afterValues,
          },
        },
      });

      return {
        id: updated.id,
        itemCode: updated.item.code,
        itemName: updated.item.name,
        batchNo: updated.batchNo,
        mfgDate: updated.mfgDate?.toISOString().split('T')[0],
        expDate: updated.expDate?.toISOString().split('T')[0],
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Query batches
   */
  async queryBatches(ctx: TenantContext, query: BatchQueryDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const where: Prisma.BatchWhereInput = { tenantId: ctx.tenantId };

      if (query.itemCode) {
        const item = await tx.item.findFirst({
          where: { tenantId: ctx.tenantId, code: query.itemCode },
        });
        // If item code doesn't match, force no results instead of silently dropping the filter
        where.itemId = item ? item.id : 'NO_MATCH';
      }

      if (!query.includeExpired) {
        where.OR = [
          { expDate: null },
          { expDate: { gt: new Date() } },
        ];
      }

      const [batches, total] = await Promise.all([
        tx.batch.findMany({
          where,
          include: {
            item: true,
            binBalances: query.withStock ? {
              select: { actualQty: true, reservedQty: true },
            } : false,
          },
          orderBy: [{ item: { code: 'asc' } }, { expDate: 'asc' }],
          take: limit,
          skip: offset,
        }),
        tx.batch.count({ where }),
      ]);

      return {
        data: batches.map(b => {
          const totalQty = query.withStock && b.binBalances
            ? b.binBalances.reduce((sum, bb) => sum + Number(bb.actualQty), 0)
            : undefined;
          const reservedQty = query.withStock && b.binBalances
            ? b.binBalances.reduce((sum, bb) => sum + Number(bb.reservedQty), 0)
            : undefined;

          return {
            id: b.id,
            itemCode: b.item.code,
            itemName: b.item.name,
            batchNo: b.batchNo,
            mfgDate: b.mfgDate?.toISOString().split('T')[0],
            expDate: b.expDate?.toISOString().split('T')[0],
            isActive: b.isActive,
            isExpired: b.expDate ? b.expDate < new Date() : false,
            daysToExpiry: b.expDate
              ? Math.ceil((b.expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null,
            ...(query.withStock ? { totalQty, reservedQty, availableQty: (totalQty || 0) - (reservedQty || 0) } : {}),
          };
        }),
        total,
        limit,
        offset,
      };
    });
  }

  /**
   * Get batch details with stock by location
   */
  async getBatchDetails(ctx: TenantContext, batchId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const batch = await tx.batch.findFirst({
        where: { id: batchId, tenantId: ctx.tenantId },
        include: {
          item: true,
          binBalances: {
            include: { warehouse: true, location: true },
          },
          serials: {
            take: 100,
            orderBy: { serialNo: 'asc' },
          },
          _count: {
            select: { serials: true },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      return {
        id: batch.id,
        itemCode: batch.item.code,
        itemName: batch.item.name,
        batchNo: batch.batchNo,
        mfgDate: batch.mfgDate?.toISOString().split('T')[0],
        expDate: batch.expDate?.toISOString().split('T')[0],
        isActive: batch.isActive,
        isExpired: batch.expDate ? batch.expDate < new Date() : false,
        stockByLocation: batch.binBalances.map(bb => ({
          warehouseCode: bb.warehouse.code,
          locationCode: bb.location.code,
          actualQty: Number(bb.actualQty),
          reservedQty: Number(bb.reservedQty),
          availableQty: Number(bb.actualQty) - Number(bb.reservedQty),
        })),
        serialCount: (batch as any)._count.serials,
        serials: batch.serials.map(s => ({
          serialNo: s.serialNo,
          status: s.status,
        })),
      };
    });
  }

  /**
   * Get expiring batches
   */
  async getExpiringBatches(ctx: TenantContext, daysAhead = 30) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysAhead);

      const batches = await tx.batch.findMany({
        where: {
          tenantId: ctx.tenantId,
          isActive: true,
          expDate: {
            not: null,
            lte: expiryDate,
            gt: new Date(),
          },
        },
        include: {
          item: true,
          binBalances: {
            select: { actualQty: true },
          },
        },
        orderBy: { expDate: 'asc' },
      });

      return batches
        .filter(b => b.binBalances.some(bb => Number(bb.actualQty) > 0))
        .map(b => ({
          id: b.id,
          itemCode: b.item.code,
          itemName: b.item.name,
          batchNo: b.batchNo,
          expDate: b.expDate?.toISOString().split('T')[0],
          daysToExpiry: b.expDate
            ? Math.ceil((b.expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null,
          stockQty: b.binBalances.reduce((sum, bb) => sum + Number(bb.actualQty), 0),
        }));
    });
  }

  // ==========================================
  // Serial Management
  // ==========================================

  /**
   * Create a single serial
   */
  async createSerial(ctx: TenantContext, dto: CreateSerialDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const item = await tx.item.findFirst({
        where: { tenantId: ctx.tenantId, code: dto.itemCode },
      });

      if (!item) {
        throw new NotFoundException(`Item not found: ${dto.itemCode}`);
      }

      if (!item.hasSerial) {
        throw new BadRequestException(`Item ${dto.itemCode} does not support serial tracking`);
      }

      const existing = await tx.serial.findFirst({
        where: { tenantId: ctx.tenantId, serialNo: dto.serialNo },
      });

      if (existing) {
        throw new BadRequestException(`Serial number ${dto.serialNo} already exists`);
      }

      // Resolve warehouse and location if provided
      let warehouseId = null;
      let locationId = null;
      let batchId = null;

      if (dto.warehouseCode) {
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId: ctx.tenantId, code: dto.warehouseCode },
        });
        if (!warehouse) {
          throw new BadRequestException(`Warehouse not found: ${dto.warehouseCode}`);
        }
        warehouseId = warehouse.id;

        if (dto.locationCode) {
          const location = await tx.location.findFirst({
            where: { tenantId: ctx.tenantId, warehouseId: warehouse.id, code: dto.locationCode },
          });
          if (!location) {
            throw new BadRequestException(`Location not found: ${dto.locationCode}`);
          }
          locationId = location.id;
        }
      }

      if (dto.batchNo) {
        const batch = await tx.batch.findFirst({
          where: { tenantId: ctx.tenantId, itemId: item.id, batchNo: dto.batchNo },
        });
        if (!batch) {
          throw new BadRequestException(`Batch not found: ${dto.batchNo}`);
        }
        batchId = batch.id;
      }

      const serial = await tx.serial.create({
        data: {
          tenantId: ctx.tenantId,
          itemId: item.id,
          serialNo: dto.serialNo,
          status: SerialStatus.AVAILABLE,
          warehouseId,
          locationId,
          batchId,
        },
        include: { item: true, warehouse: true, location: true, batch: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'create_serial',
          docType: 'Serial',
          docName: serial.serialNo,
          meta: { itemCode: dto.itemCode, serialNo: dto.serialNo },
        },
      });

      return {
        id: serial.id,
        itemCode: serial.item.code,
        itemName: serial.item.name,
        serialNo: serial.serialNo,
        status: serial.status,
        warehouseCode: serial.warehouse?.code,
        locationCode: serial.location?.code,
        batchNo: serial.batch?.batchNo,
        createdAt: serial.createdAt,
      };
    });
  }

  /**
   * Create multiple serials in bulk
   */
  async createSerialsBulk(ctx: TenantContext, dto: CreateSerialBulkDto) {
    // Phase 2 W2.7: cap per-call bulk size so a single request cannot
    // exhaust the parser, the transaction log, or memory. Callers needing
    // larger batches must page through.
    const MAX_BULK_SERIALS = 5000;
    if (!dto.serialNos || dto.serialNos.length === 0) {
      throw new BadRequestException('serialNos must not be empty');
    }
    if (dto.serialNos.length > MAX_BULK_SERIALS) {
      throw new BadRequestException(
        `Cannot create more than ${MAX_BULK_SERIALS} serials per call`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const item = await tx.item.findFirst({
        where: { tenantId: ctx.tenantId, code: dto.itemCode },
      });

      if (!item) {
        throw new NotFoundException(`Item not found: ${dto.itemCode}`);
      }

      if (!item.hasSerial) {
        throw new BadRequestException(`Item ${dto.itemCode} does not support serial tracking`);
      }

      // Check for duplicates
      const existing = await tx.serial.findMany({
        where: { tenantId: ctx.tenantId, serialNo: { in: dto.serialNos } },
        select: { serialNo: true },
      });

      if (existing.length > 0) {
        throw new BadRequestException(
          `Serial numbers already exist: ${existing.map(e => e.serialNo).join(', ')}`
        );
      }

      // Resolve warehouse and location
      let warehouseId = null;
      let locationId = null;
      let batchId = null;

      if (dto.warehouseCode) {
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId: ctx.tenantId, code: dto.warehouseCode },
        });
        if (!warehouse) {
          throw new BadRequestException(`Warehouse not found: ${dto.warehouseCode}`);
        }
        warehouseId = warehouse.id;

        if (dto.locationCode) {
          const location = await tx.location.findFirst({
            where: { tenantId: ctx.tenantId, warehouseId: warehouse.id, code: dto.locationCode },
          });
          if (!location) {
            throw new BadRequestException(`Location not found: ${dto.locationCode}`);
          }
          locationId = location.id;
        }
      }

      if (dto.batchNo) {
        const batch = await tx.batch.findFirst({
          where: { tenantId: ctx.tenantId, itemId: item.id, batchNo: dto.batchNo },
        });
        if (!batch) {
          throw new BadRequestException(`Batch not found: ${dto.batchNo}`);
        }
        batchId = batch.id;
      }

      const result = await tx.serial.createMany({
        data: dto.serialNos.map(serialNo => ({
          tenantId: ctx.tenantId,
          itemId: item.id,
          serialNo,
          status: SerialStatus.AVAILABLE,
          warehouseId,
          locationId,
          batchId,
        })),
      });

      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'bulk_create_serial',
          docType: 'Serial',
          docName: `${dto.serialNos.length} serials`,
          meta: { itemCode: dto.itemCode, count: dto.serialNos.length },
        },
      });

      return {
        created: result.count,
        itemCode: dto.itemCode,
      };
    });
  }

  /**
   * Update a serial
   */
  async updateSerial(ctx: TenantContext, serialId: string, dto: UpdateSerialDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const serial = await tx.serial.findFirst({
        where: { id: serialId, tenantId: ctx.tenantId },
      });

      if (!serial) {
        throw new NotFoundException('Serial not found');
      }

      const beforeValues = {
        status: serial.status,
        warehouseId: serial.warehouseId,
        locationId: serial.locationId,
      };

      const updateData: Record<string, unknown> = {};

      if (dto.status) {
        updateData.status = dto.status as SerialStatus;
      }

      if (dto.warehouseCode !== undefined) {
        if (dto.warehouseCode) {
          const warehouse = await tx.warehouse.findFirst({
            where: { tenantId: ctx.tenantId, code: dto.warehouseCode },
          });
          if (!warehouse) {
            throw new BadRequestException(`Warehouse not found: ${dto.warehouseCode}`);
          }
          updateData.warehouseId = warehouse.id;

          if (dto.locationCode) {
            const location = await tx.location.findFirst({
              where: { tenantId: ctx.tenantId, warehouseId: warehouse.id, code: dto.locationCode },
            });
            if (!location) {
              throw new BadRequestException(`Location not found: ${dto.locationCode}`);
            }
            updateData.locationId = location.id;
          }
        } else {
          updateData.warehouseId = null;
          updateData.locationId = null;
        }
      }

      const updated = await tx.serial.update({
        where: { id: serialId },
        data: updateData,
        include: { item: true, warehouse: true, location: true, batch: true },
      });

      const afterValues = {
        status: updated.status,
        warehouseId: updated.warehouseId,
        locationId: updated.locationId,
      };

      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'update_serial',
          docType: 'Serial',
          docName: serial.serialNo,
          meta: {
            serialId,
            serialNo: serial.serialNo,
            before: beforeValues,
            after: afterValues,
          },
        },
      });

      return {
        id: updated.id,
        itemCode: updated.item.code,
        itemName: updated.item.name,
        serialNo: updated.serialNo,
        status: updated.status,
        warehouseCode: updated.warehouse?.code,
        locationCode: updated.location?.code,
        batchNo: updated.batch?.batchNo,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Query serials
   */
  async querySerials(ctx: TenantContext, query: SerialQueryDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const where: Prisma.SerialWhereInput = { tenantId: ctx.tenantId };

      if (query.itemCode) {
        const item = await tx.item.findFirst({
          where: { tenantId: ctx.tenantId, code: query.itemCode },
        });
        // If item code doesn't match, force no results instead of silently dropping the filter
        where.itemId = item ? item.id : 'NO_MATCH';
      }

      if (query.warehouseCode) {
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId: ctx.tenantId, code: query.warehouseCode },
        });
        // If warehouse code doesn't match, force no results instead of silently dropping the filter
        where.warehouseId = warehouse ? warehouse.id : 'NO_MATCH';
      }

      if (query.status) {
        where.status = query.status as SerialStatus;
      }

      if (query.search) {
        where.serialNo = { contains: query.search, mode: 'insensitive' };
      }

      const [serials, total] = await Promise.all([
        tx.serial.findMany({
          where,
          include: {
            item: true,
            warehouse: true,
            location: true,
            batch: true,
          },
          orderBy: { serialNo: 'asc' },
          take: limit,
          skip: offset,
        }),
        tx.serial.count({ where }),
      ]);

      return {
        data: serials.map(s => ({
          id: s.id,
          itemCode: s.item.code,
          itemName: s.item.name,
          serialNo: s.serialNo,
          status: s.status,
          warehouseCode: s.warehouse?.code,
          locationCode: s.location?.code,
          batchNo: s.batch?.batchNo,
          createdAt: s.createdAt,
        })),
        total,
        limit,
        offset,
      };
    });
  }

  /**
   * Get serial history (ledger entries)
   */
  async getSerialHistory(ctx: TenantContext, serialNo: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const serial = await tx.serial.findFirst({
        where: { tenantId: ctx.tenantId, serialNo },
        include: {
          item: true,
          warehouse: true,
          location: true,
          batch: true,
          ledgerEntries: {
            include: {
              ledgerEntry: {
                include: { warehouse: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!serial) {
        throw new NotFoundException(`Serial not found: ${serialNo}`);
      }

      return {
        id: serial.id,
        itemCode: serial.item.code,
        itemName: serial.item.name,
        serialNo: serial.serialNo,
        status: serial.status,
        currentWarehouse: serial.warehouse?.code,
        currentLocation: serial.location?.code,
        batchNo: serial.batch?.batchNo,
        history: serial.ledgerEntries.map(le => ({
          date: le.ledgerEntry.postingDate.toISOString().split('T')[0],
          voucherType: le.ledgerEntry.voucherType,
          voucherNo: le.ledgerEntry.voucherNo,
          warehouse: le.ledgerEntry.warehouse.code,
          qty: Number(le.ledgerEntry.qty),
        })),
      };
    });
  }
}
