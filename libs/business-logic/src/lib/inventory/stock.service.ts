import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, StockConsumptionStrategy } from '@prisma/client';
import { PrismaService } from '@platform/db';

type VoucherRef = {
  voucherType: string;
  voucherNo: string;
  postingTs: Date;
};

type ReceiveStockInput = VoucherRef & {
  tenantId: string;
  itemCode: string;
  warehouseCode: string;
  locationCode?: string;
  batchNo?: string;
  batchExpDate?: Date;
  qty: Prisma.Decimal | number | string;
  incomingRate: Prisma.Decimal | number | string;
};

type IssueStockInput = VoucherRef & {
  tenantId: string;
  itemCode: string;
  warehouseCode: string;
  locationCode?: string;
  batchNo?: string;
  qty: Prisma.Decimal | number | string;
  strategy?: StockConsumptionStrategy;
};

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async receiveStock(input: ReceiveStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        input.batchExpDate,
      );
      const location = await this.resolveReceivingLocation(
        tx,
        input.tenantId,
        warehouse.id,
        warehouse.defaultReceivingLocationId,
        input.locationCode,
      );

      const qty = new Prisma.Decimal(input.qty);
      if (qty.lte(0)) throw new BadRequestException('qty must be > 0');

      const incomingRate = new Prisma.Decimal(input.incomingRate);
      if (incomingRate.lt(0))
        throw new BadRequestException('incomingRate must be >= 0');

      await this.upsertWarehouseBalance(tx, input.tenantId, item.id, warehouse.id, qty);
      await this.upsertBinBalance(
        tx,
        input.tenantId,
        item.id,
        warehouse.id,
        location.id,
        batch?.id,
        qty,
      );

      await tx.stockFifoLayer.create({
        data: {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId: location.id,
          batchId: batch?.id,
          postingTs: input.postingTs,
          qtyRemaining: qty,
          incomingRate,
          voucherType: input.voucherType,
          voucherNo: input.voucherNo,
        },
      });

      await tx.stockLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          postingTs: input.postingTs,
          postingDate: input.postingTs,
          itemId: item.id,
          warehouseId: warehouse.id,
          fromLocationId: null,
          toLocationId: location.id,
          batchId: batch?.id,
          qty,
          valuationRate: incomingRate,
          stockValueDifference: qty.mul(incomingRate),
          voucherType: input.voucherType,
          voucherNo: input.voucherNo,
        },
      });
    });
  }

  async issueStock(input: IssueStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);

      const tenant = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { stockConsumptionStrategy: true, allowNegativeStock: true },
      });
      if (!tenant) throw new BadRequestException('Invalid tenant');
      if (tenant.allowNegativeStock)
        throw new BadRequestException('Negative stock must be disabled for this operation');

      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        undefined,
      );
      const preferredLocationId = await this.resolvePickingLocationId(
        tx,
        input.tenantId,
        warehouse.id,
        warehouse.defaultPickingLocationId,
        input.locationCode,
      );

      const qtyToIssue = new Prisma.Decimal(input.qty);
      if (qtyToIssue.lte(0)) throw new BadRequestException('qty must be > 0');

      const warehouseBalance = await tx.warehouseItemBalance.findUnique({
        where: {
          tenantId_itemId_warehouseId: {
            tenantId: input.tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
          },
        },
      });
      const available = new Prisma.Decimal(warehouseBalance?.actualQty ?? 0).sub(
        warehouseBalance?.reservedQty ?? 0,
      );
      if (available.lt(qtyToIssue)) {
        throw new BadRequestException(
          `Insufficient stock in warehouse ${warehouse.code} for item ${item.code}`,
        );
      }

      const strategy = input.strategy ?? tenant.stockConsumptionStrategy;
      const consumption = await this.consumeFifoLayers(tx, {
        tenantId: input.tenantId,
        itemId: item.id,
        warehouseId: warehouse.id,
        locationId: preferredLocationId,
        batchId: batch?.id,
        qty: qtyToIssue,
        strategy,
      });

      const valuationRate = consumption.totalCost.div(qtyToIssue);

      await this.updateWarehouseBalance(tx, input.tenantId, item.id, warehouse.id, qtyToIssue.neg());

      for (const leg of consumption.legs) {
        await this.upsertBinBalance(
          tx,
          input.tenantId,
          item.id,
          warehouse.id,
          leg.locationId,
          batch?.id ?? leg.batchId,
          leg.qty.neg(),
        );

        await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.postingTs,
            postingDate: input.postingTs,
            itemId: item.id,
            warehouseId: warehouse.id,
            fromLocationId: leg.locationId,
            toLocationId: null,
            batchId: batch?.id ?? leg.batchId,
            qty: leg.qty.neg(),
            valuationRate,
            stockValueDifference: leg.qty.neg().mul(leg.rate),
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });
      }
    });
  }

  private async setTenant(tx: PrismaClient, tenantId: string) {
    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
  }

  private async resolveItemWarehouseBatch(
    tx: PrismaClient,
    tenantId: string,
    itemCode: string,
    warehouseCode: string,
    batchNo?: string,
    batchExpDate?: Date,
  ) {
    const [item, warehouse] = await Promise.all([
      tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } }),
      tx.warehouse.findUnique({
        where: { tenantId_code: { tenantId, code: warehouseCode } },
      }),
    ]);
    if (!item) throw new BadRequestException(`Unknown item: ${itemCode}`);
    if (!warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

    const batch =
      batchNo && item.hasBatch
        ? await this.resolveOrCreateBatch(tx, {
            tenantId,
            itemId: item.id,
            batchNo,
            batchExpDate,
          })
        : null;

    if (batchNo && !item.hasBatch) {
      throw new BadRequestException(`Item ${itemCode} is not batch-tracked`);
    }

    return { item, warehouse, batch };
  }

  private async resolveOrCreateBatch(
    tx: PrismaClient,
    input: { tenantId: string; itemId: string; batchNo: string; batchExpDate?: Date },
  ) {
    const existing = await tx.batch.findUnique({
      where: {
        tenantId_itemId_batchNo: {
          tenantId: input.tenantId,
          itemId: input.itemId,
          batchNo: input.batchNo,
        },
      },
    });

    if (!existing) {
      return tx.batch.create({
        data: {
          tenantId: input.tenantId,
          itemId: input.itemId,
          batchNo: input.batchNo,
          expDate: input.batchExpDate,
        },
      });
    }

    if (input.batchExpDate && existing.expDate) {
      const existingMs = new Date(existing.expDate).getTime();
      const inputMs = new Date(input.batchExpDate).getTime();
      if (existingMs !== inputMs) {
        throw new BadRequestException(
          `Batch ${input.batchNo} expiry mismatch (existing: ${existing.expDate.toISOString().slice(0, 10)})`,
        );
      }
    }

    if (input.batchExpDate && !existing.expDate) {
      return tx.batch.update({
        where: { id: existing.id },
        data: { expDate: input.batchExpDate },
      });
    }

    return existing;
  }

  private async resolveReceivingLocation(
    tx: PrismaClient,
    tenantId: string,
    warehouseId: string,
    defaultReceivingLocationId: string | null | undefined,
    locationCode?: string,
  ) {
    if (locationCode) {
      const location = await tx.location.findUnique({
        where: {
          tenantId_warehouseId_code: {
            tenantId,
            warehouseId,
            code: locationCode,
          },
        },
      });
      if (!location) throw new BadRequestException(`Unknown location: ${locationCode}`);
      return location;
    }

    const location = defaultReceivingLocationId
      ? await tx.location.findUnique({ where: { id: defaultReceivingLocationId } })
      : null;

    if (!location) {
      throw new BadRequestException(
        'Receiving location required (provide locationCode or set Warehouse.defaultReceivingLocationId)',
      );
    }
    return location;
  }

  private async resolvePickingLocationId(
    tx: PrismaClient,
    tenantId: string,
    warehouseId: string,
    defaultPickingLocationId: string | null | undefined,
    locationCode?: string,
  ) {
    if (locationCode) {
      const loc = await tx.location.findUnique({
        where: {
          tenantId_warehouseId_code: { tenantId, warehouseId, code: locationCode },
        },
        select: { id: true },
      });
      if (!loc) throw new BadRequestException(`Unknown location: ${locationCode}`);
      return loc.id;
    }
    return defaultPickingLocationId ?? undefined;
  }

  private async upsertWarehouseBalance(
    tx: PrismaClient,
    tenantId: string,
    itemId: string,
    warehouseId: string,
    deltaQty: Prisma.Decimal,
  ) {
    await tx.warehouseItemBalance.upsert({
      where: { tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId } },
      update: { actualQty: { increment: deltaQty } },
      create: { tenantId, itemId, warehouseId, actualQty: deltaQty, reservedQty: 0 },
    });
  }

  private async updateWarehouseBalance(
    tx: PrismaClient,
    tenantId: string,
    itemId: string,
    warehouseId: string,
    deltaQty: Prisma.Decimal,
  ) {
    await tx.warehouseItemBalance.update({
      where: { tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId } },
      data: { actualQty: { increment: deltaQty } },
    });
  }

  private async upsertBinBalance(
    tx: PrismaClient,
    tenantId: string,
    itemId: string,
    warehouseId: string,
    locationId: string,
    batchId: string | null | undefined,
    deltaQty: Prisma.Decimal,
  ) {
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
      update: { actualQty: { increment: deltaQty } },
      create: {
        tenantId,
        itemId,
        warehouseId,
        locationId,
        batchId: batchId ?? null,
        actualQty: deltaQty,
      },
    });
  }

  private async consumeFifoLayers(
    tx: PrismaClient,
    input: {
      tenantId: string;
      itemId: string;
      warehouseId: string;
      locationId?: string;
      batchId?: string;
      qty: Prisma.Decimal;
      strategy: StockConsumptionStrategy;
    },
  ) {
    const legs: Array<{
      layerId: string;
      locationId: string;
      batchId: string | null;
      qty: Prisma.Decimal;
      rate: Prisma.Decimal;
    }> = [];
    let remaining = new Prisma.Decimal(input.qty);
    let totalCost = new Prisma.Decimal(0);

    while (remaining.gt(0)) {
      const layer = await tx.stockFifoLayer.findFirst({
        where: {
          tenantId: input.tenantId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          ...(input.locationId ? { locationId: input.locationId } : {}),
          ...(input.batchId ? { batchId: input.batchId } : {}),
          qtyRemaining: { gt: 0 },
        },
        include: { batch: true },
        orderBy:
          input.strategy === StockConsumptionStrategy.FEFO
            ? [
                { batch: { expDate: { sort: 'asc', nulls: 'last' } } },
                { postingTs: 'asc' },
              ]
            : [{ postingTs: 'asc' }],
      });

      if (!layer) {
        throw new BadRequestException('Insufficient FIFO layers for issue');
      }

      const take = Prisma.Decimal.min(layer.qtyRemaining, remaining);

      await tx.stockFifoLayer.update({
        where: { id: layer.id },
        data: { qtyRemaining: { decrement: take } },
      });

      legs.push({
        layerId: layer.id,
        locationId: layer.locationId,
        batchId: layer.batchId,
        qty: take,
        rate: layer.incomingRate,
      });

      totalCost = totalCost.add(take.mul(layer.incomingRate));
      remaining = remaining.sub(take);
    }

    return { legs, totalCost };
  }
}
