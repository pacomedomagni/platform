import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma } from '@platform/db';
import { MovementType, CreateStockMovementDto, StockMovementQueryDto } from './inventory-management.dto';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

@Injectable()
export class StockMovementService {
  private readonly logger = new Logger(StockMovementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a stock movement (receipt, issue, transfer, adjustment)
   */
  async createMovement(ctx: TenantContext, dto: CreateStockMovementDto) {
    const postingDate = dto.postingDate ? new Date(dto.postingDate) : new Date();
    const postingTs = new Date();

    // Validate posting date: reject dates more than 1 year in the past or in the future
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (postingDate > now) {
      throw new BadRequestException('Posting date cannot be in the future');
    }
    if (postingDate < oneYearAgo) {
      throw new BadRequestException('Posting date cannot be more than 1 year in the past');
    }

    return this.prisma.$transaction(async (tx) => {
      // Validate warehouse
      const warehouse = await tx.warehouse.findFirst({
        where: { tenantId: ctx.tenantId, code: dto.warehouseCode },
      });
      if (!warehouse) {
        throw new BadRequestException(`Warehouse not found: ${dto.warehouseCode}`);
      }

      // Validate destination warehouse for transfers
      let toWarehouse = null;
      if (dto.movementType === MovementType.TRANSFER) {
        if (!dto.toWarehouseCode) {
          throw new BadRequestException('Destination warehouse required for transfers');
        }
        toWarehouse = await tx.warehouse.findFirst({
          where: { tenantId: ctx.tenantId, code: dto.toWarehouseCode },
        });
        if (!toWarehouse) {
          throw new BadRequestException(`Destination warehouse not found: ${dto.toWarehouseCode}`);
        }
      }

      const voucherNo = await this.generateVoucherNo(tx, ctx.tenantId, dto.movementType);
      const ledgerEntries: any[] = [];
      const processedItems: any[] = [];

      for (const itemDto of dto.items) {
        // Validate item
        const item = await tx.item.findFirst({
          where: { tenantId: ctx.tenantId, code: itemDto.itemCode },
        });
        if (!item) {
          throw new BadRequestException(`Item not found: ${itemDto.itemCode}`);
        }

        // Validate batch if specified
        let batch = null;
        if (itemDto.batchNo) {
          if (!item.hasBatch) {
            throw new BadRequestException(`Item ${item.code} does not track batches`);
          }
          batch = await tx.batch.findFirst({
            where: { tenantId: ctx.tenantId, itemId: item.id, batchNo: itemDto.batchNo },
          });
          if (!batch) {
            // Create batch if it doesn't exist (for receipts)
            if (dto.movementType === MovementType.RECEIPT) {
              batch = await tx.batch.create({
                data: {
                  tenantId: ctx.tenantId,
                  itemId: item.id,
                  batchNo: itemDto.batchNo,
                },
              });
            } else {
              throw new BadRequestException(`Batch not found: ${itemDto.batchNo}`);
            }
          }
        }

        // Validate serial if specified
        if (itemDto.serialNo) {
          if (!item.hasSerial) {
            throw new BadRequestException(`Item ${item.code} does not track serials`);
          }
        }

        // Get or validate location
        let fromLocation = null;
        let toLocation = null;

        if (itemDto.locationCode) {
          fromLocation = await tx.location.findFirst({
            where: { tenantId: ctx.tenantId, warehouseId: warehouse.id, code: itemDto.locationCode },
          });
          if (!fromLocation) {
            throw new BadRequestException(`Location not found: ${itemDto.locationCode}`);
          }
        }

        if (itemDto.toLocationCode) {
          const targetWarehouse = toWarehouse || warehouse;
          toLocation = await tx.location.findFirst({
            where: { tenantId: ctx.tenantId, warehouseId: targetWarehouse.id, code: itemDto.toLocationCode },
          });
          if (!toLocation) {
            throw new BadRequestException(`Destination location not found: ${itemDto.toLocationCode}`);
          }
        }

        // Determine quantity sign and rate
        let qty: Prisma.Decimal;
        let rate: Prisma.Decimal;

        switch (dto.movementType) {
          case MovementType.RECEIPT:
            qty = new Prisma.Decimal(itemDto.quantity);
            rate = new Prisma.Decimal(itemDto.rate || 0);
            break;
          case MovementType.ISSUE:
            qty = new Prisma.Decimal(-itemDto.quantity);
            rate = new Prisma.Decimal(itemDto.rate || 0);
            break;
          case MovementType.TRANSFER:
            // Create two entries: negative from source, positive to destination
            qty = new Prisma.Decimal(-itemDto.quantity);
            rate = new Prisma.Decimal(itemDto.rate || 0);
            break;
          case MovementType.ADJUSTMENT:
            // Positive or negative based on sign
            qty = new Prisma.Decimal(itemDto.quantity);
            rate = new Prisma.Decimal(itemDto.rate || 0);
            break;
          default:
            qty = new Prisma.Decimal(itemDto.quantity);
            rate = new Prisma.Decimal(0);
        }

        const stockValueDiff = qty.mul(rate);

        // Acquire advisory lock to prevent race conditions
        await this.lockStock(tx, ctx.tenantId, warehouse.id, item.id);

        // Validate negative stock before processing negative movements
        if (qty.lessThan(0)) {
          const tenant = await tx.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { allowNegativeStock: true },
          });

          if (!tenant?.allowNegativeStock) {
            const currentBalance = await tx.warehouseItemBalance.findUnique({
              where: {
                tenantId_itemId_warehouseId: {
                  tenantId: ctx.tenantId,
                  itemId: item.id,
                  warehouseId: warehouse.id,
                },
              },
            });

            const availableQty = currentBalance
              ? currentBalance.actualQty.minus(currentBalance.reservedQty)
              : new Prisma.Decimal(0);

            if (availableQty.lessThan(qty.abs())) {
              throw new BadRequestException(
                `Insufficient stock for ${item.code}. Available: ${availableQty}, Required: ${qty.abs()}`
              );
            }

            // Bin-level negative stock check
            if (fromLocation) {
              const binBalance = await tx.binBalance.findFirst({
                where: {
                  tenantId: ctx.tenantId,
                  itemId: item.id,
                  warehouseId: warehouse.id,
                  locationId: fromLocation.id,
                },
              });

              const binQty = binBalance
                ? new Prisma.Decimal(binBalance.actualQty)
                : new Prisma.Decimal(0);

              if (binQty.add(qty).lessThan(0)) {
                throw new BadRequestException(
                  `Insufficient bin stock for ${item.code} at location ${itemDto.locationCode}. Bin available: ${binQty}, Required: ${qty.abs()}`
                );
              }
            }
          }
        }

        // Create stock ledger entry
        const entry = await tx.stockLedgerEntry.create({
          data: {
            tenantId: ctx.tenantId,
            postingTs,
            postingDate,
            itemId: item.id,
            warehouseId: warehouse.id,
            fromLocationId: fromLocation?.id,
            toLocationId: toLocation?.id,
            batchId: batch?.id,
            qty,
            valuationRate: rate,
            stockValueDifference: stockValueDiff,
            voucherType: this.getVoucherType(dto.movementType),
            voucherNo,
          },
        });

        ledgerEntries.push(entry);

        // Update warehouse balance atomically
        await this.updateWarehouseBalance(tx, ctx.tenantId, item.id, warehouse.id, qty);

        // Update bin (location) balance if location specified
        if (fromLocation) {
          await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, fromLocation.id, qty);
        }
        if (toLocation && dto.movementType !== MovementType.TRANSFER) {
          await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, toLocation.id, qty);
        }

        // For transfers, create the receiving entry
        if (dto.movementType === MovementType.TRANSFER && toWarehouse) {
          // Acquire lock for destination warehouse
          await this.lockStock(tx, ctx.tenantId, toWarehouse.id, item.id);

          const receiveEntry = await tx.stockLedgerEntry.create({
            data: {
              tenantId: ctx.tenantId,
              postingTs,
              postingDate,
              itemId: item.id,
              warehouseId: toWarehouse.id,
              toLocationId: toLocation?.id,
              batchId: batch?.id,
              qty: qty.neg(), // Positive quantity
              valuationRate: rate,
              stockValueDifference: stockValueDiff.neg(),
              voucherType: this.getVoucherType(dto.movementType),
              voucherNo,
            },
          });
          ledgerEntries.push(receiveEntry);

          // Update destination warehouse balance atomically
          await this.updateWarehouseBalance(tx, ctx.tenantId, item.id, toWarehouse.id, qty.neg());

          // Update destination bin balance if location specified
          if (toLocation) {
            await this.updateBinBalance(tx, ctx.tenantId, item.id, toWarehouse.id, toLocation.id, qty.neg());
          }
        }

        processedItems.push({
          itemCode: item.code,
          itemName: item.name,
          quantity: Math.abs(itemDto.quantity),
          batch: batch?.batchNo,
          rate: Number(rate),
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: `stock_${dto.movementType}`,
          docType: 'StockMovement',
          docName: voucherNo,
          meta: {
            movementType: dto.movementType,
            warehouse: dto.warehouseCode,
            toWarehouse: dto.toWarehouseCode,
            items: processedItems,
            reference: dto.reference,
            remarks: dto.remarks,
          },
        },
      });

      return {
        voucherNo,
        voucherType: this.getVoucherType(dto.movementType),
        movementType: dto.movementType,
        postingDate: postingDate.toISOString().split('T')[0],
        warehouse: dto.warehouseCode,
        toWarehouse: dto.toWarehouseCode,
        items: processedItems,
        entries: ledgerEntries.length,
      };
    });
  }

  /**
   * Query stock movements
   */
  async queryMovements(ctx: TenantContext, query: StockMovementQueryDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const where: any = { tenantId: ctx.tenantId };

      if (query.movementType) {
        where.voucherType = this.getVoucherType(query.movementType);
      }

      if (query.warehouseCode) {
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId: ctx.tenantId, code: query.warehouseCode },
        });
        if (warehouse) {
          where.warehouseId = warehouse.id;
        }
      }

      if (query.itemCode) {
        const item = await tx.item.findFirst({
          where: { tenantId: ctx.tenantId, code: query.itemCode },
        });
        if (item) {
          where.itemId = item.id;
        }
      }

      if (query.fromDate || query.toDate) {
        where.postingDate = {};
        if (query.fromDate) where.postingDate.gte = new Date(query.fromDate);
        if (query.toDate) where.postingDate.lte = new Date(query.toDate);
      }

      const [entries, total] = await Promise.all([
        tx.stockLedgerEntry.findMany({
          where,
          include: {
            item: true,
            warehouse: true,
            fromLocation: true,
            toLocation: true,
            batch: true,
          },
          orderBy: { postingTs: 'desc' },
          take: limit,
          skip: offset,
        }),
        tx.stockLedgerEntry.count({ where }),
      ]);

      return {
        data: entries.map(e => ({
          id: e.id,
          postingDate: e.postingDate.toISOString().split('T')[0],
          postingTs: e.postingTs,
          voucherType: e.voucherType,
          voucherNo: e.voucherNo,
          itemCode: e.item.code,
          itemName: e.item.name,
          warehouseCode: e.warehouse.code,
          fromLocation: e.fromLocation?.code,
          toLocation: e.toLocation?.code,
          batchNo: e.batch?.batchNo,
          qty: Number(e.qty),
          rate: Number(e.valuationRate),
          value: Number(e.stockValueDifference),
        })),
        total,
        limit,
        offset,
      };
    });
  }

  /**
   * Get movement summary by type
   */
  async getMovementSummary(ctx: TenantContext, startDate?: Date, endDate?: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const where: any = { tenantId: ctx.tenantId };
      if (startDate || endDate) {
        where.postingDate = {};
        if (startDate) where.postingDate.gte = startDate;
        if (endDate) where.postingDate.lte = endDate;
      }

      const entries = await tx.stockLedgerEntry.findMany({
        where,
        select: { voucherType: true, qty: true, stockValueDifference: true },
      });

      const summary: Record<string, { count: number; totalQty: number; totalValue: number }> = {};

      for (const entry of entries) {
        if (!summary[entry.voucherType]) {
          summary[entry.voucherType] = { count: 0, totalQty: 0, totalValue: 0 };
        }
        summary[entry.voucherType].count++;
        summary[entry.voucherType].totalQty += Math.abs(Number(entry.qty));
        summary[entry.voucherType].totalValue += Math.abs(Number(entry.stockValueDifference));
      }

      return summary;
    });
  }

  /**
   * Get recent movements for an item
   */
  async getItemMovements(ctx: TenantContext, itemCode: string, limit = 20) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const item = await tx.item.findFirst({
        where: { tenantId: ctx.tenantId, code: itemCode },
      });
      if (!item) {
        throw new NotFoundException(`Item not found: ${itemCode}`);
      }

      const entries = await tx.stockLedgerEntry.findMany({
        where: { tenantId: ctx.tenantId, itemId: item.id },
        include: {
          warehouse: true,
          fromLocation: true,
          toLocation: true,
          batch: true,
        },
        orderBy: { postingTs: 'desc' },
        take: limit,
      });

      // Calculate running balance
      let runningQty = 0;
      const movements = entries.reverse().map(e => {
        runningQty += Number(e.qty);
        return {
          id: e.id,
          postingDate: e.postingDate.toISOString().split('T')[0],
          voucherType: e.voucherType,
          voucherNo: e.voucherNo,
          warehouseCode: e.warehouse.code,
          qty: Number(e.qty),
          runningBalance: runningQty,
          rate: Number(e.valuationRate),
        };
      }).reverse();

      return {
        itemCode: item.code,
        itemName: item.name,
        movements,
      };
    });
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Generate voucher number using posting markers for idempotency
   * Prevents duplicate voucher numbers in concurrent transactions
   */
  private async generateVoucherNo(tx: any, tenantId: string, type: MovementType): Promise<string> {
    const prefix = {
      [MovementType.RECEIPT]: 'SR',
      [MovementType.ISSUE]: 'SI',
      [MovementType.TRANSFER]: 'ST',
      [MovementType.ADJUSTMENT]: 'SA',
    }[type];

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const voucherType = this.getVoucherType(type);

    // Use posting markers to prevent duplicate sequence numbers
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Find the highest sequence number
      const lastEntry = await tx.stockLedgerEntry.findFirst({
        where: {
          tenantId,
          voucherType,
          voucherNo: { startsWith: `${prefix}-${year}${month}` },
        },
        orderBy: { voucherNo: 'desc' },
        select: { voucherNo: true },
      });

      const nextSeq = lastEntry
        ? parseInt(lastEntry.voucherNo.split('-').pop() || '0') + 1
        : 1;

      const voucherNo = `${prefix}-${year}${month}-${String(nextSeq).padStart(5, '0')}`;

      // Try to create a posting marker to claim this voucher number
      try {
        await tx.stockPosting.create({
          data: {
            tenantId,
            postingTs: new Date(),
            voucherType,
            voucherNo,
            status: 'draft',
          },
        });
        return voucherNo;
      } catch (error: any) {
        // If unique constraint violated, retry with next number
        if (error.code === 'P2002' && attempt < maxRetries - 1) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate unique voucher number after retries');
  }

  private getVoucherType(type: MovementType): string {
    return {
      [MovementType.RECEIPT]: 'Stock Receipt',
      [MovementType.ISSUE]: 'Stock Issue',
      [MovementType.TRANSFER]: 'Stock Transfer',
      [MovementType.ADJUSTMENT]: 'Stock Adjustment',
    }[type];
  }

  /**
   * Acquire PostgreSQL advisory lock for stock operations
   * Prevents race conditions in concurrent stock movements
   */
  private async lockStock(tx: any, tenantId: string, warehouseId: string, itemId: string) {
    const key = `${tenantId}:${warehouseId}:${itemId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  /**
   * Update warehouse balance atomically using upsert
   * Prevents race conditions during concurrent updates
   */
  private async updateWarehouseBalance(
    tx: any,
    tenantId: string,
    itemId: string,
    warehouseId: string,
    qty: Prisma.Decimal
  ) {
    await tx.warehouseItemBalance.upsert({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId,
          itemId,
          warehouseId,
        },
      },
      update: {
        actualQty: { increment: qty },
      },
      create: {
        tenantId,
        itemId,
        warehouseId,
        actualQty: qty,
        reservedQty: 0,
      },
    });
  }

  /**
   * Update bin (location) balance atomically
   */
  private async updateBinBalance(
    tx: any,
    tenantId: string,
    itemId: string,
    warehouseId: string,
    locationId: string | null,
    qty: Prisma.Decimal
  ) {
    if (!locationId) return;

    await tx.binBalance.upsert({
      where: {
        tenantId_itemId_warehouseId_locationId: {
          tenantId,
          itemId,
          warehouseId,
          locationId,
        },
      },
      update: {
        actualQty: { increment: qty },
      },
      create: {
        tenantId,
        itemId,
        warehouseId,
        locationId,
        actualQty: qty,
        reservedQty: 0,
      },
    });
  }
}
