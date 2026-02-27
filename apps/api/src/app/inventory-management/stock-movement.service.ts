import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma } from '@platform/db';
import { SerialStatus, StockConsumptionStrategy } from '@prisma/client';
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

    // Validate items array is not empty
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    // Validate quantity signs based on movement type
    for (const item of dto.items) {
      if (dto.movementType === MovementType.RECEIPT && item.quantity <= 0) {
        throw new BadRequestException(`Receipt quantity must be positive for item ${item.itemCode}`);
      }
      if (dto.movementType === MovementType.ISSUE && item.quantity <= 0) {
        throw new BadRequestException(`Issue quantity must be positive for item ${item.itemCode}`);
      }
      if (dto.movementType === MovementType.TRANSFER && item.quantity <= 0) {
        throw new BadRequestException(`Transfer quantity must be positive for item ${item.itemCode}`);
      }
      if (dto.movementType === MovementType.ADJUSTMENT && item.quantity === 0) {
        throw new BadRequestException(`Adjustment quantity cannot be zero for item ${item.itemCode}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Validate warehouse
      const warehouse = await tx.warehouse.findFirst({
        where: { tenantId: ctx.tenantId, code: dto.warehouseCode },
      });
      if (!warehouse) {
        throw new BadRequestException(`Warehouse not found: ${dto.warehouseCode}`);
      }
      if (!warehouse.isActive) {
        throw new BadRequestException(`Warehouse is inactive: ${dto.warehouseCode}`);
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
        if (!toWarehouse.isActive) {
          throw new BadRequestException(`Destination warehouse is inactive: ${dto.toWarehouseCode}`);
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

        // ── FIFO / FEFO layer management ──
        const isPositive = qty.greaterThan(0);
        const isNegative = qty.lessThan(0);

        if (dto.movementType === MovementType.RECEIPT || (dto.movementType === MovementType.ADJUSTMENT && isPositive)) {
          // RECEIPT or positive ADJUSTMENT → create a new layer
          const layerLocationId = await this.resolveLayerLocationId(
            tx, ctx.tenantId, warehouse.id,
            toLocation?.id ?? fromLocation?.id,
            warehouse.defaultReceivingLocationId,
          );

          const layer = await tx.stockFifoLayer.create({
            data: {
              tenantId: ctx.tenantId,
              itemId: item.id,
              warehouseId: warehouse.id,
              locationId: layerLocationId,
              batchId: batch?.id,
              postingTs,
              qtyOriginal: qty,
              qtyRemaining: qty,
              incomingRate: rate,
              isCancelled: false,
              voucherType: this.getVoucherType(dto.movementType),
              voucherNo,
            },
          });

          // Link the ledger entry to the new layer
          await tx.stockLedgerEntry.update({
            where: { id: entry.id },
            data: { fifoLayerId: layer.id },
          });
        } else if (dto.movementType === MovementType.ISSUE || (dto.movementType === MovementType.ADJUSTMENT && isNegative)) {
          // ISSUE or negative ADJUSTMENT → consume layers (FIFO or FEFO)
          const tenant = await tx.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { stockConsumptionStrategy: true },
          });
          const strategy = tenant?.stockConsumptionStrategy ?? StockConsumptionStrategy.FIFO;

          const consumption = await this.consumeFifoLayers(tx, {
            tenantId: ctx.tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: fromLocation?.id,
            batchId: batch?.id,
            qty: qty.abs(),
            strategy,
          });

          // Link the ledger entry to the first consumed layer
          if (consumption.legs.length > 0) {
            await tx.stockLedgerEntry.update({
              where: { id: entry.id },
              data: { fifoLayerId: consumption.legs[0].layerId },
            });
          }
        }
        // TRANSFER is handled separately below

        // Track serials: create StockLedgerEntrySerial records and update serial status
        if (item.hasSerial && itemDto.serialNo) {
          const serialNos = itemDto.serialNo.split(',').map(s => s.trim()).filter(Boolean);

          for (const sn of serialNos) {
            // Upsert serial: create on RECEIPT if it doesn't exist, otherwise require it to exist
            let serial = await tx.serial.findFirst({
              where: { tenantId: ctx.tenantId, serialNo: sn },
            });

            if (!serial && dto.movementType === MovementType.RECEIPT) {
              serial = await tx.serial.create({
                data: {
                  tenantId: ctx.tenantId,
                  itemId: item.id,
                  serialNo: sn,
                  status: SerialStatus.AVAILABLE,
                  warehouseId: warehouse.id,
                  batchId: batch?.id ?? null,
                },
              });
            }

            if (!serial) {
              throw new BadRequestException(`Serial not found: ${sn}`);
            }

            // Link serial to ledger entry
            await tx.stockLedgerEntrySerial.create({
              data: {
                tenantId: ctx.tenantId,
                ledgerEntryId: entry.id,
                serialId: serial.id,
              },
            });

            // Update serial status and location based on movement type
            const serialUpdate: any = {};
            switch (dto.movementType) {
              case MovementType.RECEIPT:
                serialUpdate.status = SerialStatus.AVAILABLE;
                serialUpdate.warehouseId = warehouse.id;
                serialUpdate.locationId = toLocation?.id ?? fromLocation?.id ?? null;
                break;
              case MovementType.ISSUE:
                serialUpdate.status = SerialStatus.ISSUED;
                serialUpdate.warehouseId = null;
                serialUpdate.locationId = null;
                break;
              case MovementType.TRANSFER:
                // Source side of transfer -- destination side handled below
                break;
              case MovementType.ADJUSTMENT:
                if (qty.greaterThan(0)) {
                  serialUpdate.status = SerialStatus.AVAILABLE;
                  serialUpdate.warehouseId = warehouse.id;
                  serialUpdate.locationId = toLocation?.id ?? fromLocation?.id ?? null;
                } else {
                  serialUpdate.status = SerialStatus.ISSUED;
                  serialUpdate.warehouseId = null;
                  serialUpdate.locationId = null;
                }
                break;
            }

            if (Object.keys(serialUpdate).length > 0) {
              await tx.serial.update({
                where: { id: serial.id },
                data: serialUpdate,
              });
            }
          }
        }

        // Update warehouse balance atomically
        await this.updateWarehouseBalance(tx, ctx.tenantId, item.id, warehouse.id, qty);

        // Update bin (location) balance if location specified
        if (fromLocation) {
          await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, fromLocation.id, qty, batch?.id ?? null);
        }
        if (toLocation && dto.movementType !== MovementType.TRANSFER) {
          await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, toLocation.id, qty, batch?.id ?? null);
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

          // Track serials on the receiving side of the transfer
          if (item.hasSerial && itemDto.serialNo) {
            const serialNos = itemDto.serialNo.split(',').map(s => s.trim()).filter(Boolean);

            for (const sn of serialNos) {
              const serial = await tx.serial.findFirst({
                where: { tenantId: ctx.tenantId, serialNo: sn },
              });

              if (serial) {
                // Link serial to the receiving ledger entry
                await tx.stockLedgerEntrySerial.create({
                  data: {
                    tenantId: ctx.tenantId,
                    ledgerEntryId: receiveEntry.id,
                    serialId: serial.id,
                  },
                });

                // Update serial to destination warehouse/location
                await tx.serial.update({
                  where: { id: serial.id },
                  data: {
                    warehouseId: toWarehouse.id,
                    locationId: toLocation?.id ?? null,
                  },
                });
              }
            }
          }

          // Update destination warehouse balance atomically
          await this.updateWarehouseBalance(tx, ctx.tenantId, item.id, toWarehouse.id, qty.neg());

          // Update destination bin balance if location specified
          if (toLocation) {
            await this.updateBinBalance(tx, ctx.tenantId, item.id, toWarehouse.id, toLocation.id, qty.neg(), batch?.id ?? null);
          }

          // ── FIFO layer handling for transfer ──
          // 1. Consume layers from source warehouse
          const tenant = await tx.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { stockConsumptionStrategy: true },
          });
          const strategy = tenant?.stockConsumptionStrategy ?? StockConsumptionStrategy.FIFO;

          const consumption = await this.consumeFifoLayers(tx, {
            tenantId: ctx.tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: fromLocation?.id,
            batchId: batch?.id,
            qty: qty.abs(), // qty is negative for source side, use absolute
            strategy,
          });

          // Link the source ledger entry to the first consumed layer
          if (consumption.legs.length > 0) {
            await tx.stockLedgerEntry.update({
              where: { id: entry.id },
              data: { fifoLayerId: consumption.legs[0].layerId },
            });
          }

          // 2. Create new layers on destination warehouse with consumed rates
          const destLayerLocationId = await this.resolveLayerLocationId(
            tx, ctx.tenantId, toWarehouse.id,
            toLocation?.id,
            toWarehouse.defaultReceivingLocationId,
          );

          let firstDestLayerId: string | null = null;
          for (const leg of consumption.legs) {
            const destLayer = await tx.stockFifoLayer.create({
              data: {
                tenantId: ctx.tenantId,
                itemId: item.id,
                warehouseId: toWarehouse.id,
                locationId: destLayerLocationId,
                batchId: leg.batchId,
                postingTs,
                qtyOriginal: leg.qty,
                qtyRemaining: leg.qty,
                incomingRate: leg.rate,
                isCancelled: false,
                sourceLayerId: leg.layerId,
                voucherType: this.getVoucherType(dto.movementType),
                voucherNo,
              },
            });
            if (!firstDestLayerId) firstDestLayerId = destLayer.id;
          }

          // Link the receiving ledger entry to the first destination layer
          if (firstDestLayerId) {
            await tx.stockLedgerEntry.update({
              where: { id: receiveEntry.id },
              data: { fifoLayerId: firstDestLayerId },
            });
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
            postingKey: `${voucherType}:${voucherNo}`,
            voucherType,
            voucherNo,
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
    qty: Prisma.Decimal,
    batchId: string | null = null,
  ) {
    if (!locationId) return;

    await tx.binBalance.upsert({
      where: {
        tenantId_itemId_warehouseId_locationId_batchId: {
          tenantId,
          itemId,
          warehouseId,
          locationId,
          batchId: batchId ?? null,
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
        batchId: batchId ?? null,
        actualQty: qty,
        reservedQty: 0,
      },
    });
  }

  /**
   * Resolve a locationId for FIFO layer creation.
   * StockFifoLayer.locationId is required, so we must resolve one from:
   * 1. The explicit location from the movement
   * 2. The warehouse's default receiving/picking location
   * 3. If neither is available, throw an error
   */
  private async resolveLayerLocationId(
    tx: any,
    tenantId: string,
    warehouseId: string,
    explicitLocationId: string | null | undefined,
    defaultLocationId: string | null | undefined,
  ): Promise<string> {
    if (explicitLocationId) return explicitLocationId;
    if (defaultLocationId) return defaultLocationId;

    // Fallback: find the first active location in this warehouse
    const fallback = await tx.location.findFirst({
      where: { tenantId, warehouseId, isActive: true },
      select: { id: true },
      orderBy: { code: 'asc' },
    });

    if (!fallback) {
      throw new BadRequestException(
        'Cannot create FIFO layer: no location specified and warehouse has no default or active locations',
      );
    }

    return fallback.id;
  }

  /**
   * Consume FIFO/FEFO layers for a given item+warehouse.
   *
   * Finds layers with qtyRemaining > 0 ordered by strategy:
   *   FIFO → postingTs ASC (oldest first)
   *   FEFO → batch.expDate ASC NULLS LAST, then postingTs ASC
   *
   * Deducts from each layer until the issued qty is satisfied.
   * Returns the consumption legs with layerId, locationId, batchId, qty, and rate.
   */
  private async consumeFifoLayers(
    tx: any,
    input: {
      tenantId: string;
      itemId: string;
      warehouseId: string;
      locationId?: string;
      batchId?: string;
      qty: Prisma.Decimal;
      strategy: StockConsumptionStrategy;
    },
  ): Promise<{
    legs: Array<{
      layerId: string;
      locationId: string;
      batchId: string | null;
      qty: Prisma.Decimal;
      rate: Prisma.Decimal;
    }>;
    totalCost: Prisma.Decimal;
  }> {
    const legs: Array<{
      layerId: string;
      locationId: string;
      batchId: string | null;
      qty: Prisma.Decimal;
      rate: Prisma.Decimal;
    }> = [];
    let remaining = new Prisma.Decimal(input.qty);
    let totalCost = new Prisma.Decimal(0);

    // Build ORDER BY clause based on strategy
    const orderByClause = input.strategy === StockConsumptionStrategy.FEFO
      ? Prisma.sql`ORDER BY b."expDate" ASC NULLS LAST, l."postingTs" ASC`
      : Prisma.sql`ORDER BY l."postingTs" ASC`;

    // Build optional WHERE conditions
    const locationCondition = input.locationId
      ? Prisma.sql`AND l."locationId" = ${input.locationId}`
      : Prisma.sql``;
    const batchCondition = input.batchId
      ? Prisma.sql`AND l."batchId" = ${input.batchId}`
      : Prisma.sql``;

    while (remaining.gt(0)) {
      // SELECT FOR UPDATE to lock the row atomically and prevent race conditions
      const layers = await tx.$queryRaw<Array<{
        id: string;
        locationId: string;
        batchId: string | null;
        qtyRemaining: Prisma.Decimal;
        incomingRate: Prisma.Decimal;
      }>>`
        SELECT l."id", l."locationId", l."batchId", l."qtyRemaining", l."incomingRate"
        FROM "stock_fifo_layers" l
        LEFT JOIN "batches" b ON l."batchId" = b."id"
        WHERE l."tenantId" = ${input.tenantId}
          AND l."itemId" = ${input.itemId}
          AND l."warehouseId" = ${input.warehouseId}
          AND l."qtyRemaining" > 0
          AND l."isCancelled" = false
          ${locationCondition}
          ${batchCondition}
        ${orderByClause}
        LIMIT 1
        FOR UPDATE OF l SKIP LOCKED
      `;

      if (layers.length === 0) {
        // Check if any layers exist at all (they might be locked by another transaction)
        const anyLayers = await tx.stockFifoLayer.findFirst({
          where: {
            tenantId: input.tenantId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            ...(input.locationId ? { locationId: input.locationId } : {}),
            ...(input.batchId ? { batchId: input.batchId } : {}),
            qtyRemaining: { gt: 0 },
            isCancelled: false,
          },
        });

        if (anyLayers) {
          // Layers exist but are locked -- retry after a brief pause
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }

        // No layers at all -- insufficient stock
        throw new BadRequestException(
          'Insufficient FIFO layers to satisfy the issued quantity',
        );
      }

      const layer = layers[0];
      const qtyRemaining = new Prisma.Decimal(layer.qtyRemaining);
      const take = Prisma.Decimal.min(qtyRemaining, remaining);

      // Update the layer's remaining quantity
      await tx.stockFifoLayer.update({
        where: { id: layer.id },
        data: { qtyRemaining: { decrement: take } },
      });

      const incomingRate = new Prisma.Decimal(layer.incomingRate);

      legs.push({
        layerId: layer.id,
        locationId: layer.locationId,
        batchId: layer.batchId,
        qty: take,
        rate: incomingRate,
      });

      totalCost = totalCost.add(take.mul(incomingRate));
      remaining = remaining.sub(take);
    }

    return { legs, totalCost };
  }
}
