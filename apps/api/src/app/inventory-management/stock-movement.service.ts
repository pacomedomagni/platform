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

    // Validate source and destination warehouses are different for transfers
    if (dto.movementType === MovementType.TRANSFER && dto.warehouseCode === dto.toWarehouseCode) {
      throw new BadRequestException('Source and destination warehouses must be different');
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

    // Retry logic for transaction serialization failures (max 3 attempts)
    // Only retry on Prisma P2034 (transaction serialization failure), NOT on
    // "Insufficient FIFO layers" which is a legitimate data condition.
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this._executeMovementTransaction(ctx, dto, postingDate, postingTs);
      } catch (error) {
        lastError = error as Error;
        const prismaError = error as { code?: string };
        if (prismaError.code === 'P2034' && attempt < MAX_RETRIES - 1) {
          this.logger.warn(`Transaction serialization failure on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Internal: Execute the movement transaction
   */
  private async _executeMovementTransaction(
    ctx: TenantContext,
    dto: CreateStockMovementDto,
    postingDate: Date,
    postingTs: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Set RLS tenant context
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      // Idempotency check: if a reference is provided, check if a movement with the same reference already exists
      if (dto.reference) {
        const existing = await tx.auditLog.findFirst({
          where: {
            tenantId: ctx.tenantId,
            docType: 'StockMovement',
            meta: { path: ['reference'], equals: dto.reference },
          },
        });
        if (existing) {
          this.logger.log(`Stock movement already exists for reference: ${dto.reference}, skipping`);
          return { voucherNo: existing.docName, alreadyExists: true };
        }
      }

      // Validate warehouse (exclude soft-deleted)
      const warehouse = await tx.warehouse.findFirst({
        where: { tenantId: ctx.tenantId, code: dto.warehouseCode, deletedAt: null },
      });
      if (!warehouse) {
        throw new BadRequestException(`Warehouse not found: ${dto.warehouseCode}`);
      }
      if (!warehouse.isActive) {
        throw new BadRequestException(`Warehouse is inactive: ${dto.warehouseCode}`);
      }

      // Validate destination warehouse for transfers (exclude soft-deleted)
      let toWarehouse = null;
      if (dto.movementType === MovementType.TRANSFER) {
        if (!dto.toWarehouseCode) {
          throw new BadRequestException('Destination warehouse required for transfers');
        }
        toWarehouse = await tx.warehouse.findFirst({
          where: { tenantId: ctx.tenantId, code: dto.toWarehouseCode, deletedAt: null },
        });
        if (!toWarehouse) {
          throw new BadRequestException(`Destination warehouse not found: ${dto.toWarehouseCode}`);
        }
        if (!toWarehouse.isActive) {
          throw new BadRequestException(`Destination warehouse is inactive: ${dto.toWarehouseCode}`);
        }
      }

      const voucherNo = await this.generateVoucherNo(tx, ctx.tenantId, dto.movementType);
      const ledgerEntries: Array<{ id: string; voucherNo: string; voucherType: string }> = [];
      const processedItems: Array<{ itemCode: string; itemName: string; quantity: number; batch?: string; rate: number }> = [];

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
            where: { tenantId: ctx.tenantId, warehouseId: warehouse.id, code: itemDto.locationCode, deletedAt: null },
          });
          if (!fromLocation) {
            throw new BadRequestException(`Location not found: ${itemDto.locationCode}`);
          }
        }

        if (itemDto.toLocationCode) {
          const targetWarehouse = toWarehouse || warehouse;
          toLocation = await tx.location.findFirst({
            where: { tenantId: ctx.tenantId, warehouseId: targetWarehouse.id, code: itemDto.toLocationCode, deletedAt: null },
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
        // For transfers, acquire locks in deterministic order to prevent deadlocks
        if (dto.movementType === MovementType.TRANSFER && toWarehouse) {
          const [firstWh, secondWh] = [warehouse.id, toWarehouse.id].sort();
          await this.lockStock(tx, ctx.tenantId, firstWh, item.id);
          if (firstWh !== secondWh) {
            await this.lockStock(tx, ctx.tenantId, secondWh, item.id);
          }
        } else {
          await this.lockStock(tx, ctx.tenantId, warehouse.id, item.id);
        }

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

            // Bin-level negative stock check (subtract reserved qty)
            if (fromLocation) {
              const binBalance = await tx.binBalance.findFirst({
                where: {
                  tenantId: ctx.tenantId,
                  itemId: item.id,
                  warehouseId: warehouse.id,
                  locationId: fromLocation.id,
                },
              });

              const binActual = binBalance ? new Prisma.Decimal(binBalance.actualQty) : new Prisma.Decimal(0);
              const binReserved = binBalance ? new Prisma.Decimal(binBalance.reservedQty || 0) : new Prisma.Decimal(0);
              const binAvailable = binActual.sub(binReserved);

              if (binAvailable.add(qty).lessThan(0)) {
                throw new BadRequestException(
                  `Insufficient bin stock for ${item.code} at location ${itemDto.locationCode}. Bin available: ${binAvailable}, Required: ${qty.abs()}`
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
        let issueConsumption: { legs: Array<{ layerId: string; locationId: string; batchId: string | null; qty: Prisma.Decimal; rate: Prisma.Decimal }>; totalCost: Prisma.Decimal } | null = null;

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
          issueConsumption = consumption;

          // For ISSUE movements, derive the rate from consumed FIFO layers
          // instead of using user-supplied rate
          if (dto.movementType === MovementType.ISSUE && consumption.legs.length > 0) {
            const fifoRate = consumption.totalCost.div(qty.abs());
            const fifoValueDiff = qty.mul(fifoRate);
            // Update the ledger entry with the FIFO-derived rate
            await tx.stockLedgerEntry.update({
              where: { id: entry.id },
              data: {
                valuationRate: fifoRate,
                stockValueDifference: fifoValueDiff,
                fifoLayerId: consumption.legs[0].layerId,
              },
            });
          } else if (consumption.legs.length > 0) {
            // Link the ledger entry to the first consumed layer
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
            // Filter by itemId to prevent cross-item serial linking
            let serial = await tx.serial.findFirst({
              where: { tenantId: ctx.tenantId, serialNo: sn, itemId: item.id },
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
            const serialUpdate: Record<string, unknown> = {};
            switch (dto.movementType) {
              case MovementType.RECEIPT:
                serialUpdate.status = SerialStatus.AVAILABLE;
                serialUpdate.warehouseId = warehouse.id;
                serialUpdate.locationId = toLocation?.id ?? fromLocation?.id ?? null;
                break;
              case MovementType.ISSUE:
                // Phase 2 W2.7: keep warehouseId on the serial after issue.
                // Nulling it erased the last-known warehouse, breaking
                // downstream lookups for return / RMA flows. The status
                // (ISSUED) signals the row is no longer in inventory; the
                // warehouseId records *where* it was issued from.
                serialUpdate.status = SerialStatus.ISSUED;
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
                  // Phase 2 W2.7: same reasoning as ISSUE — preserve
                  // warehouseId for traceability.
                  serialUpdate.status = SerialStatus.ISSUED;
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
        // For ISSUE/negative-ADJUSTMENT with FIFO consumption, iterate per-leg to update each location's bin balance
        if (issueConsumption && issueConsumption.legs.length > 0 && dto.movementType !== MovementType.TRANSFER) {
          for (const leg of issueConsumption.legs) {
            await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, leg.locationId, leg.qty.neg(), leg.batchId);
          }
        } else if (dto.movementType !== MovementType.TRANSFER) {
          const locationForBin = fromLocation || toLocation;
          if (locationForBin) {
            await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, locationForBin.id, qty, batch?.id ?? null);
          }
        } else if (fromLocation) {
          // For transfers, update source location bin balance (destination handled below)
          await this.updateBinBalance(tx, ctx.tenantId, item.id, warehouse.id, fromLocation.id, qty, batch?.id ?? null);
        }

        // For transfers, create the receiving entry
        if (dto.movementType === MovementType.TRANSFER && toWarehouse) {
          // Lock already acquired above in deterministic order

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
                where: { tenantId: ctx.tenantId, serialNo: sn, itemId: item.id },
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

      const where: Prisma.StockLedgerEntryWhereInput = { tenantId: ctx.tenantId };

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
        const dateFilter: { gte?: Date; lte?: Date } = {};
        if (query.fromDate) dateFilter.gte = new Date(query.fromDate);
        if (query.toDate) dateFilter.lte = new Date(query.toDate);
        where.postingDate = dateFilter;
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

      // Build date filter conditions for raw SQL
      const dateConditions: ReturnType<typeof Prisma.sql>[] = [];
      if (startDate) {
        dateConditions.push(Prisma.sql`AND "postingDate" >= ${startDate}`);
      }
      if (endDate) {
        dateConditions.push(Prisma.sql`AND "postingDate" <= ${endDate}`);
      }
      const dateClause = dateConditions.length > 0
        ? Prisma.sql`${Prisma.join(dateConditions, ' ')}`
        : Prisma.empty;

      // Phase 2 W2.7: report inbound and outbound separately. The previous
      // SUM(ABS(qty)) collapsed signs, making receipts and issues both look
      // positive — the financial summary was unreadable. We now expose:
      //   inboundQty, inboundValue   (positive movements)
      //   outboundQty, outboundValue (negative movements, reported as +)
      //   netQty, netValue           (signed sum)
      const results = await tx.$queryRaw<Array<{
        voucherType: string;
        count: bigint;
        inboundQty: Prisma.Decimal;
        outboundQty: Prisma.Decimal;
        inboundValue: Prisma.Decimal;
        outboundValue: Prisma.Decimal;
        netQty: Prisma.Decimal;
        netValue: Prisma.Decimal;
      }>>`
        SELECT
          "voucherType",
          COUNT(*)::bigint AS "count",
          COALESCE(SUM(CASE WHEN qty > 0 THEN qty ELSE 0 END), 0) AS "inboundQty",
          COALESCE(SUM(CASE WHEN qty < 0 THEN -qty ELSE 0 END), 0) AS "outboundQty",
          COALESCE(SUM(CASE WHEN "stockValueDifference" > 0 THEN "stockValueDifference" ELSE 0 END), 0) AS "inboundValue",
          COALESCE(SUM(CASE WHEN "stockValueDifference" < 0 THEN -"stockValueDifference" ELSE 0 END), 0) AS "outboundValue",
          COALESCE(SUM(qty), 0) AS "netQty",
          COALESCE(SUM("stockValueDifference"), 0) AS "netValue"
        FROM "stock_ledger_entries"
        WHERE "tenantId" = ${ctx.tenantId}
        ${dateClause}
        GROUP BY "voucherType"
      `;

      const summary: Record<string, {
        count: number;
        inboundQty: number;
        outboundQty: number;
        inboundValue: number;
        outboundValue: number;
        netQty: number;
        netValue: number;
        // Backward-compat aliases (totalQty / totalValue = abs sums) so
        // existing FE consumers that read those fields keep working.
        totalQty: number;
        totalValue: number;
      }> = {};
      for (const row of results) {
        const inboundQty = Number(row.inboundQty);
        const outboundQty = Number(row.outboundQty);
        const inboundValue = Number(row.inboundValue);
        const outboundValue = Number(row.outboundValue);
        summary[row.voucherType] = {
          count: Number(row.count),
          inboundQty,
          outboundQty,
          inboundValue,
          outboundValue,
          netQty: Number(row.netQty),
          netValue: Number(row.netValue),
          totalQty: inboundQty + outboundQty,
          totalValue: inboundValue + outboundValue,
        };
      }

      return summary;
    });
  }

  /**
   * Get recent movements for an item
   */
  async getItemMovements(ctx: TenantContext, itemCode: string, limit = 20, offset = 0) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${ctx.tenantId}, true)`;

      const item = await tx.item.findFirst({
        where: { tenantId: ctx.tenantId, code: itemCode },
      });
      if (!item) {
        throw new NotFoundException(`Item not found: ${itemCode}`);
      }

      // Count total entries for pagination
      const total = await tx.stockLedgerEntry.count({
        where: { tenantId: ctx.tenantId, itemId: item.id },
      });

      // Phase 2 W2.7: rewrite running balance with a SQL window function.
      // The previous implementation summed total qty, queried the newer
      // entries separately, and subtracted — an off-by-one in the page
      // boundary plus a Decimal-to-Number coercion meant the running
      // balance on paginated pages was wrong by one entry.
      //
      // The new query computes `SUM(qty) OVER (ORDER BY postingTs ASC ROWS
      // BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` for every entry, then
      // we slice the requested page from the result. Order is restored to
      // DESC for the response (newest first).
      type RawEntry = {
        id: string;
        postingDate: Date;
        postingTs: Date;
        voucherType: string;
        voucherNo: string;
        warehouseCode: string;
        qty: string;
        runningBalance: string;
        rate: string;
      };
      const allEntries = await tx.$queryRaw<RawEntry[]>`
        SELECT
          sle.id,
          sle."postingDate",
          sle."postingTs",
          sle."voucherType",
          sle."voucherNo",
          w.code AS "warehouseCode",
          sle.qty::text AS qty,
          SUM(sle.qty) OVER (
            ORDER BY sle."postingTs" ASC, sle.id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )::text AS "runningBalance",
          sle."valuationRate"::text AS rate
        FROM stock_ledger_entries sle
        JOIN warehouses w ON w.id = sle."warehouseId"
        WHERE sle."tenantId" = ${ctx.tenantId}
          AND sle."itemId"   = ${item.id}
        ORDER BY sle."postingTs" DESC, sle.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const movements = allEntries.map((e) => ({
        id: e.id,
        postingDate: e.postingDate.toISOString().split('T')[0],
        voucherType: e.voucherType,
        voucherNo: e.voucherNo,
        warehouseCode: e.warehouseCode,
        qty: Number(e.qty),
        runningBalance: Number(e.runningBalance),
        rate: Number(e.rate),
      }));

      return {
        itemCode: item.code,
        itemName: item.name,
        movements,
        total,
        limit,
        offset,
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
  private async generateVoucherNo(tx: Prisma.TransactionClient, tenantId: string, type: MovementType): Promise<string> {
    const prefix = {
      [MovementType.RECEIPT]: 'SR',
      [MovementType.ISSUE]: 'SI',
      [MovementType.TRANSFER]: 'ST',
      [MovementType.ADJUSTMENT]: 'SA',
    }[type];

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    const voucherType = this.getVoucherType(type);

    // Phase 2 W2.7: atomic sequence via Postgres function.
    // The previous findMax-then-loop pattern produced duplicate voucher
    // numbers under concurrent load: two transactions could both read the
    // same max, both increment locally, then race on stock_postings unique;
    // the loser's retry would only increment its own counter, not re-read
    // the latest value, sometimes producing a still-duplicate number.
    //
    // next_voucher_seq() does the increment in a single INSERT ... ON CONFLICT
    // statement, scoped to (tenantId, voucherType, yearMonth).
    const seqResult = await tx.$queryRaw<Array<{ next_voucher_seq: number }>>`
      SELECT next_voucher_seq(${tenantId}::uuid, ${voucherType}, ${yearMonth}) AS next_voucher_seq
    `;
    const nextSeq = seqResult[0]?.next_voucher_seq;
    if (typeof nextSeq !== 'number') {
      throw new Error('next_voucher_seq did not return a value');
    }
    const voucherNo = `${prefix}-${yearMonth}-${String(nextSeq).padStart(5, '0')}`;

    // Posting marker remains as a defense-in-depth idempotency record
    // (a single voucherNo cannot be claimed twice across the whole table).
    await tx.stockPosting.create({
      data: {
        tenantId,
        postingKey: `${voucherType}:${voucherNo}`,
        voucherType,
        voucherNo,
      },
    });
    return voucherNo;
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
  private async lockStock(tx: Prisma.TransactionClient, tenantId: string, warehouseId: string, itemId: string) {
    const key = `${tenantId}:${warehouseId}:${itemId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  /**
   * Update warehouse balance atomically using upsert
   * Prevents race conditions during concurrent updates
   */
  private async updateWarehouseBalance(
    tx: Prisma.TransactionClient,
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
    tx: Prisma.TransactionClient,
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
          batchId: batchId ?? '__NO_BATCH__',
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
        batchId: batchId ?? '__NO_BATCH__',
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
    tx: Prisma.TransactionClient,
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
    tx: Prisma.TransactionClient,
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
        // Phase 2 W2.7: SKIP LOCKED returns empty in two distinct cases:
        //   (a) the layers truly are exhausted -> "insufficient stock"
        //   (b) all eligible layers are locked by concurrent transactions
        // Distinguish them by re-querying without SKIP LOCKED. If a row
        // exists but is locked, throw a serialization error so the caller's
        // outer retry loop (createMovement's _executeMovementTransaction)
        // can retry the whole movement on a fresh transaction.
        const probe = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT l.id
          FROM "stock_fifo_layers" l
          WHERE l."tenantId" = ${input.tenantId}
            AND l."itemId" = ${input.itemId}
            AND l."warehouseId" = ${input.warehouseId}
            AND l."qtyRemaining" > 0
            AND l."isCancelled" = false
            ${locationCondition}
            ${batchCondition}
          LIMIT 1
        `;
        if (probe.length > 0) {
          // Eligible layer exists but is locked by another tx. Force a
          // serialization-failure-style retry by raising a Postgres
          // 40001-equivalent error. createMovement retries on P2034.
          const err = new Error(
            'FIFO layer contention: eligible layers are locked by concurrent transactions',
          ) as Error & { code?: string };
          err.code = 'P2034';
          throw err;
        }
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
