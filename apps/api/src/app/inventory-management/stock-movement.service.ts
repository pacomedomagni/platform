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

        // Update warehouse balance
        await this.updateWarehouseBalance(tx, ctx.tenantId, item.id, warehouse.id, qty);

        // For transfers, create the receiving entry
        if (dto.movementType === MovementType.TRANSFER && toWarehouse) {
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

          // Update destination warehouse balance
          await this.updateWarehouseBalance(tx, ctx.tenantId, item.id, toWarehouse.id, qty.neg());
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
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const where: any = { tenantId: ctx.tenantId };

    if (query.movementType) {
      where.voucherType = this.getVoucherType(query.movementType);
    }

    if (query.warehouseCode) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { tenantId: ctx.tenantId, code: query.warehouseCode },
      });
      if (warehouse) {
        where.warehouseId = warehouse.id;
      }
    }

    if (query.itemCode) {
      const item = await this.prisma.item.findFirst({
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
      this.prisma.stockLedgerEntry.findMany({
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
      this.prisma.stockLedgerEntry.count({ where }),
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
  }

  /**
   * Get movement summary by type
   */
  async getMovementSummary(ctx: TenantContext, startDate?: Date, endDate?: Date) {
    const where: any = { tenantId: ctx.tenantId };
    if (startDate || endDate) {
      where.postingDate = {};
      if (startDate) where.postingDate.gte = startDate;
      if (endDate) where.postingDate.lte = endDate;
    }

    const entries = await this.prisma.stockLedgerEntry.findMany({
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
  }

  /**
   * Get recent movements for an item
   */
  async getItemMovements(ctx: TenantContext, itemCode: string, limit = 20) {
    const item = await this.prisma.item.findFirst({
      where: { tenantId: ctx.tenantId, code: itemCode },
    });
    if (!item) {
      throw new NotFoundException(`Item not found: ${itemCode}`);
    }

    const entries = await this.prisma.stockLedgerEntry.findMany({
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
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private async generateVoucherNo(tx: any, tenantId: string, type: MovementType): Promise<string> {
    const prefix = {
      [MovementType.RECEIPT]: 'SR',
      [MovementType.ISSUE]: 'SI',
      [MovementType.TRANSFER]: 'ST',
      [MovementType.ADJUSTMENT]: 'SA',
    }[type];

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const count = await tx.stockLedgerEntry.count({
      where: {
        tenantId,
        voucherType: this.getVoucherType(type),
        voucherNo: { startsWith: `${prefix}-${year}${month}` },
      },
    });

    return `${prefix}-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }

  private getVoucherType(type: MovementType): string {
    return {
      [MovementType.RECEIPT]: 'Stock Receipt',
      [MovementType.ISSUE]: 'Stock Issue',
      [MovementType.TRANSFER]: 'Stock Transfer',
      [MovementType.ADJUSTMENT]: 'Stock Adjustment',
    }[type];
  }

  private async updateWarehouseBalance(
    tx: any,
    tenantId: string,
    itemId: string,
    warehouseId: string,
    qty: Prisma.Decimal
  ) {
    const existing = await tx.warehouseItemBalance.findFirst({
      where: { tenantId, itemId, warehouseId },
    });

    if (existing) {
      await tx.warehouseItemBalance.update({
        where: { id: existing.id },
        data: { actualQty: existing.actualQty.add(qty) },
      });
    } else {
      await tx.warehouseItemBalance.create({
        data: {
          tenantId,
          itemId,
          warehouseId,
          actualQty: qty,
          reservedQty: 0,
        },
      });
    }
  }
}
