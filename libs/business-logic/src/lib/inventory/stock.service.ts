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
  postingKey: string;
  itemCode: string;
  warehouseCode: string;
  locationCode?: string;
  batchNo?: string;
  batchExpDate?: Date;
  serialNos?: string[] | string;
  uomCode?: string;
  conversionFactor?: Prisma.Decimal | number | string;
  qty: Prisma.Decimal | number | string;
  incomingRate: Prisma.Decimal | number | string;
};

type IssueStockInput = VoucherRef & {
  tenantId: string;
  postingKey: string;
  itemCode: string;
  warehouseCode: string;
  locationCode?: string;
  batchNo?: string;
  serialNos?: string[] | string;
  uomCode?: string;
  conversionFactor?: Prisma.Decimal | number | string;
  qty: Prisma.Decimal | number | string;
  strategy?: StockConsumptionStrategy;
  consumeReservation?: boolean;
};

type TransferStockInput = VoucherRef & {
  tenantId: string;
  postingKey: string;
  itemCode: string;
  qty: Prisma.Decimal | number | string;
  batchNo?: string;
  serialNos?: string[] | string;
  uomCode?: string;
  conversionFactor?: Prisma.Decimal | number | string;
  fromWarehouseCode: string;
  fromLocationCode?: string;
  toWarehouseCode: string;
  toLocationCode?: string;
  strategy?: StockConsumptionStrategy;
};

type ReserveStockInput = VoucherRef & {
  tenantId: string;
  postingKey: string;
  itemCode: string;
  warehouseCode: string;
  locationCode?: string;
  batchNo?: string;
  uomCode?: string;
  conversionFactor?: Prisma.Decimal | number | string;
  qty: Prisma.Decimal | number | string;
};

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async receiveStock(input: ReceiveStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyPosted = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: input.postingKey,
        voucherType: input.voucherType,
        voucherNo: input.voucherNo,
      });
      if (alreadyPosted) return;

      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        input.batchExpDate,
      );
      await this.lockStock(tx, input.tenantId, warehouse.id, item.id);
      const location = await this.resolveReceivingLocation(
        tx,
        input.tenantId,
        warehouse.id,
        warehouse.defaultReceivingLocationId,
        input.locationCode,
      );

      const { stockQty, conversionFactor } = await this.resolveStockQty(tx, {
        tenantId: input.tenantId,
        item,
        qty: input.qty,
        uomCode: input.uomCode,
        conversionFactor: input.conversionFactor,
      });
      if (stockQty.lte(0)) throw new BadRequestException('qty must be > 0');

      const incomingRate = new Prisma.Decimal(input.incomingRate);
      if (incomingRate.lt(0))
        throw new BadRequestException('incomingRate must be >= 0');
      const stockRate = this.resolveStockRate(incomingRate, conversionFactor);

      const serials = this.parseSerials(input.serialNos);
      if (item.hasSerial) {
        this.ensureUniqueSerials(serials);
        this.ensureSerialQty(stockQty, serials.length);
        await this.ensureSerialsAvailable(tx, input.tenantId, item.id, serials);
      } else if (serials.length > 0) {
        throw new BadRequestException(`Item ${item.code} is not serial-tracked`);
      }

      await this.upsertWarehouseBalance(tx, input.tenantId, item.id, warehouse.id, stockQty);
      await this.upsertBinBalance(
        tx,
        input.tenantId,
        item.id,
        warehouse.id,
        location.id,
        batch?.id,
        stockQty,
      );

      await tx.stockFifoLayer.create({
        data: {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId: location.id,
          batchId: batch?.id,
          postingTs: input.postingTs,
          qtyOriginal: stockQty,
          qtyRemaining: stockQty,
          incomingRate: stockRate,
          isCancelled: false,
          voucherType: input.voucherType,
          voucherNo: input.voucherNo,
        },
      });

      const ledger = await tx.stockLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          postingTs: input.postingTs,
          postingDate: input.postingTs,
          itemId: item.id,
          warehouseId: warehouse.id,
          fromLocationId: null,
          toLocationId: location.id,
          batchId: batch?.id,
          qty: stockQty,
          valuationRate: stockRate,
          stockValueDifference: stockQty.mul(stockRate),
          voucherType: input.voucherType,
          voucherNo: input.voucherNo,
        },
      });

      if (item.hasSerial && serials.length > 0) {
        const created = await tx.serial.createMany({
          data: serials.map((serialNo) => ({
            tenantId: input.tenantId,
            itemId: item.id,
            serialNo,
            status: 'AVAILABLE',
            warehouseId: warehouse.id,
            locationId: location.id,
            batchId: batch?.id,
          })),
        });
        if (created.count !== serials.length) {
          throw new BadRequestException('Failed to create all serials');
        }
        const serialRows = await tx.serial.findMany({
          where: { tenantId: input.tenantId, serialNo: { in: serials } },
          select: { id: true },
        });
        await tx.stockLedgerEntrySerial.createMany({
          data: serialRows.map((s) => ({
            tenantId: input.tenantId,
            ledgerEntryId: ledger.id,
            serialId: s.id,
          })),
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_RECEIVE', input.voucherType, input.voucherNo, {
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        locationCode: input.locationCode,
        qty: stockQty.toString(),
      });
    });
  }

  async issueStock(input: IssueStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyPosted = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: input.postingKey,
        voucherType: input.voucherType,
        voucherNo: input.voucherNo,
      });
      if (alreadyPosted) return;

      const tenant = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { stockConsumptionStrategy: true, allowNegativeStock: true },
      });
      if (!tenant) throw new BadRequestException('Invalid tenant');

      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        undefined,
      );
      await this.lockStock(tx, input.tenantId, warehouse.id, item.id);
      const preferredLocationId = await this.resolvePickingLocationId(
        tx,
        input.tenantId,
        warehouse.id,
        warehouse.defaultPickingLocationId,
        input.locationCode,
      );

      const { stockQty } = await this.resolveStockQty(tx, {
        tenantId: input.tenantId,
        item,
        qty: input.qty,
        uomCode: input.uomCode,
        conversionFactor: input.conversionFactor,
      });
      const qtyToIssue = stockQty;
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
      const warehouseActual = new Prisma.Decimal(warehouseBalance?.actualQty ?? 0);
      const warehouseReserved = new Prisma.Decimal(warehouseBalance?.reservedQty ?? 0);
      const allowReserved = Boolean(input.consumeReservation);
      const available = allowReserved ? warehouseActual : warehouseActual.sub(warehouseReserved);
      if (!tenant.allowNegativeStock && available.lt(qtyToIssue)) {
        throw new BadRequestException(
          `Insufficient stock in warehouse ${warehouse.code} for item ${item.code}`,
        );
      }

      if (preferredLocationId && !tenant.allowNegativeStock) {
        const locationAvailable = await this.getLocationAvailableQty(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId: preferredLocationId,
          batchId: batch?.id,
          includeReserved: allowReserved,
        });
        if (locationAvailable.lt(qtyToIssue)) {
          throw new BadRequestException(
            `Insufficient stock in location for item ${item.code} in warehouse ${warehouse.code}`,
          );
        }
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
      if (allowReserved && warehouseReserved.gt(0)) {
        const reduceQty = Prisma.Decimal.min(warehouseReserved, qtyToIssue);
        await tx.warehouseItemBalance.update({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: input.tenantId,
              itemId: item.id,
              warehouseId: warehouse.id,
            },
          },
          data: { reservedQty: { decrement: reduceQty } },
        });

        if (preferredLocationId) {
          const binBalance = await tx.binBalance.findUnique({
            where: {
              tenantId_itemId_warehouseId_locationId_batchId: {
                tenantId: input.tenantId,
                itemId: item.id,
                warehouseId: warehouse.id,
                locationId: preferredLocationId,
                batchId: batch?.id ?? null,
              },
            },
          });
          const reservedInBin = new Prisma.Decimal(binBalance?.reservedQty ?? 0);
          if (reservedInBin.gt(0)) {
            const reduceBin = Prisma.Decimal.min(reservedInBin, qtyToIssue);
            await tx.binBalance.update({
              where: { id: binBalance!.id },
              data: { reservedQty: { decrement: reduceBin } },
            });
          }
        }
      }

      const serials = this.parseSerials(input.serialNos);
      if (item.hasSerial) {
        this.ensureUniqueSerials(serials);
        this.ensureSerialQty(qtyToIssue, serials.length);
        await this.ensureSerialsInLocation(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          serialNos: serials,
          warehouseId: warehouse.id,
          locationId: preferredLocationId,
          batchId: batch?.id,
        });
      } else if (serials.length > 0) {
        throw new BadRequestException(`Item ${item.code} is not serial-tracked`);
      }

      const serialQueue = [...serials];

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

        const ledger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.postingTs,
            postingDate: input.postingTs,
            itemId: item.id,
            warehouseId: warehouse.id,
            fromLocationId: leg.locationId,
            toLocationId: null,
            batchId: batch?.id ?? leg.batchId,
            fifoLayerId: leg.layerId,
            qty: leg.qty.neg(),
            valuationRate,
            stockValueDifference: leg.qty.neg().mul(leg.rate),
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        if (item.hasSerial && serialQueue.length > 0) {
          const takeCount = leg.qty.toNumber();
          const legSerials = serialQueue.splice(0, takeCount);
          const serialRows = await tx.serial.findMany({
            where: { tenantId: input.tenantId, serialNo: { in: legSerials } },
            select: { id: true },
          });
          await tx.stockLedgerEntrySerial.createMany({
            data: serialRows.map((s) => ({
              tenantId: input.tenantId,
              ledgerEntryId: ledger.id,
              serialId: s.id,
            })),
          });
        }
      }
      if (item.hasSerial && serialQueue.length !== 0) {
        throw new BadRequestException('Serial allocation mismatch for issue');
      }

      if (item.hasSerial && serials.length > 0) {
        await tx.serial.updateMany({
          where: { tenantId: input.tenantId, serialNo: { in: serials } },
          data: { status: 'ISSUED', warehouseId: null, locationId: null },
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_ISSUE', input.voucherType, input.voucherNo, {
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        locationCode: input.locationCode,
        qty: qtyToIssue.toString(),
      });
    });
  }

  async transferStock(input: TransferStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyPosted = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: input.postingKey,
        voucherType: input.voucherType,
        voucherNo: input.voucherNo,
      });
      if (alreadyPosted) return;

      const tenant = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { stockConsumptionStrategy: true, allowNegativeStock: true },
      });
      if (!tenant) throw new BadRequestException('Invalid tenant');

      const [from, to] = await Promise.all([
        this.resolveItemWarehouseBatch(
          tx,
          input.tenantId,
          input.itemCode,
          input.fromWarehouseCode,
          input.batchNo,
          undefined,
        ),
        this.resolveItemWarehouseBatch(
          tx,
          input.tenantId,
          input.itemCode,
          input.toWarehouseCode,
          input.batchNo,
          undefined,
        ),
      ]);

      await this.lockStock(tx, input.tenantId, from.warehouse.id, from.item.id);
      if (to.warehouse.id !== from.warehouse.id) {
        await this.lockStock(tx, input.tenantId, to.warehouse.id, to.item.id);
      }

      const fromLocationId = await this.resolvePickingLocationId(
        tx,
        input.tenantId,
        from.warehouse.id,
        from.warehouse.defaultPickingLocationId,
        input.fromLocationCode,
      );
      if (!fromLocationId) {
        throw new BadRequestException(
          'From location required (provide from_location or set Warehouse.defaultPickingLocationId)',
        );
      }

      const toLocation = await this.resolveReceivingLocation(
        tx,
        input.tenantId,
        to.warehouse.id,
        to.warehouse.defaultReceivingLocationId,
        input.toLocationCode,
      );

      const { stockQty } = await this.resolveStockQty(tx, {
        tenantId: input.tenantId,
        item: from.item,
        qty: input.qty,
        uomCode: input.uomCode,
        conversionFactor: input.conversionFactor,
      });
      const qtyToMove = stockQty;
      if (qtyToMove.lte(0)) throw new BadRequestException('qty must be > 0');

      const serials = this.parseSerials(input.serialNos);
      if (from.item.hasSerial) {
        this.ensureUniqueSerials(serials);
        this.ensureSerialQty(qtyToMove, serials.length);
        await this.ensureSerialsInLocation(tx, {
          tenantId: input.tenantId,
          itemId: from.item.id,
          serialNos: serials,
          warehouseId: from.warehouse.id,
          locationId: fromLocationId,
          batchId: from.batch?.id,
        });
      } else if (serials.length > 0) {
        throw new BadRequestException(`Item ${from.item.code} is not serial-tracked`);
      }

      const warehouseBalance = await tx.warehouseItemBalance.findUnique({
        where: {
          tenantId_itemId_warehouseId: {
            tenantId: input.tenantId,
            itemId: from.item.id,
            warehouseId: from.warehouse.id,
          },
        },
      });
      const available = new Prisma.Decimal(warehouseBalance?.actualQty ?? 0).sub(
        warehouseBalance?.reservedQty ?? 0,
      );
      if (!tenant.allowNegativeStock && available.lt(qtyToMove)) {
        throw new BadRequestException(
          `Insufficient stock in warehouse ${from.warehouse.code} for item ${from.item.code}`,
        );
      }

      if (fromLocationId && !tenant.allowNegativeStock) {
        const locationAvailable = await this.getLocationAvailableQty(tx, {
          tenantId: input.tenantId,
          itemId: from.item.id,
          warehouseId: from.warehouse.id,
          locationId: fromLocationId,
          batchId: from.batch?.id,
        });
        if (locationAvailable.lt(qtyToMove)) {
          throw new BadRequestException(
            `Insufficient stock in from location for item ${from.item.code}`,
          );
        }
      }

      const strategy = input.strategy ?? tenant.stockConsumptionStrategy;
      const consumption = await this.consumeFifoLayers(tx, {
        tenantId: input.tenantId,
        itemId: from.item.id,
        warehouseId: from.warehouse.id,
        locationId: fromLocationId,
        batchId: from.batch?.id,
        qty: qtyToMove,
        strategy,
      });

      await this.updateWarehouseBalance(
        tx,
        input.tenantId,
        from.item.id,
        from.warehouse.id,
        qtyToMove.neg(),
      );
      await this.upsertWarehouseBalance(tx, input.tenantId, to.item.id, to.warehouse.id, qtyToMove);

      const serialQueue = [...serials];

      for (const leg of consumption.legs) {
        await this.upsertBinBalance(
          tx,
          input.tenantId,
          from.item.id,
          from.warehouse.id,
          leg.locationId,
          leg.batchId,
          leg.qty.neg(),
        );

        const destLayer = await tx.stockFifoLayer.create({
          data: {
            tenantId: input.tenantId,
            itemId: to.item.id,
            warehouseId: to.warehouse.id,
            locationId: toLocation.id,
            batchId: leg.batchId,
            postingTs: input.postingTs,
            qtyOriginal: leg.qty,
            qtyRemaining: leg.qty,
            incomingRate: leg.rate,
            isCancelled: false,
            sourceLayerId: leg.layerId,
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        await this.upsertBinBalance(
          tx,
          input.tenantId,
          to.item.id,
          to.warehouse.id,
          toLocation.id,
          leg.batchId,
          leg.qty,
        );

        const outLedger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.postingTs,
            postingDate: input.postingTs,
            itemId: from.item.id,
            warehouseId: from.warehouse.id,
            fromLocationId: leg.locationId,
            toLocationId: null,
            batchId: leg.batchId,
            fifoLayerId: leg.layerId,
            qty: leg.qty.neg(),
            valuationRate: leg.rate,
            stockValueDifference: leg.qty.neg().mul(leg.rate),
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        const inLedger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.postingTs,
            postingDate: input.postingTs,
            itemId: to.item.id,
            warehouseId: to.warehouse.id,
            fromLocationId: null,
            toLocationId: toLocation.id,
            batchId: leg.batchId,
            fifoLayerId: destLayer.id,
            qty: leg.qty,
            valuationRate: leg.rate,
            stockValueDifference: leg.qty.mul(leg.rate),
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        if (from.item.hasSerial && serialQueue.length > 0) {
          const takeCount = leg.qty.toNumber();
          const legSerials = serialQueue.splice(0, takeCount);
          const serialRows = await tx.serial.findMany({
            where: { tenantId: input.tenantId, serialNo: { in: legSerials } },
            select: { id: true },
          });
          await tx.stockLedgerEntrySerial.createMany({
            data: serialRows.flatMap((s) => [
              { tenantId: input.tenantId, ledgerEntryId: outLedger.id, serialId: s.id },
              { tenantId: input.tenantId, ledgerEntryId: inLedger.id, serialId: s.id },
            ]),
          });
        }
      }
      if (from.item.hasSerial && serialQueue.length !== 0) {
        throw new BadRequestException('Serial allocation mismatch for transfer');
      }

      if (from.item.hasSerial && serials.length > 0) {
        await tx.serial.updateMany({
          where: { tenantId: input.tenantId, serialNo: { in: serials } },
          data: { warehouseId: to.warehouse.id, locationId: toLocation.id },
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_TRANSFER', input.voucherType, input.voucherNo, {
        itemCode: input.itemCode,
        fromWarehouse: input.fromWarehouseCode,
        toWarehouse: input.toWarehouseCode,
        qty: qtyToMove.toString(),
      });
    });
  }

  async cancelPurchaseReceipt(input: {
    tenantId: string;
    voucherNo: string;
    cancelTs: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyCancelled = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: `CANCEL:Purchase Receipt:${input.voucherNo}`,
        voucherType: 'Purchase Receipt (Cancel)',
        voucherNo: input.voucherNo,
      });
      if (alreadyCancelled) return;

      const layers = await tx.stockFifoLayer.findMany({
        where: {
          tenantId: input.tenantId,
          voucherType: 'Purchase Receipt',
          voucherNo: input.voucherNo,
          isCancelled: false,
        },
      });
      if (layers.length === 0) return;

      for (const layer of layers) {
        if (layer.qtyRemaining.lt(layer.qtyOriginal)) {
          throw new BadRequestException(
            `Cannot cancel Purchase Receipt ${input.voucherNo}: stock already consumed`,
          );
        }
      }

      const serialLinks = await tx.stockLedgerEntrySerial.findMany({
        where: {
          tenantId: input.tenantId,
          ledgerEntry: { voucherType: 'Purchase Receipt', voucherNo: input.voucherNo },
        },
        select: { serialId: true },
      });

      for (const layer of layers) {
        const qty = layer.qtyOriginal;

        const warehouseBalance = await tx.warehouseItemBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: input.tenantId,
              itemId: layer.itemId,
              warehouseId: layer.warehouseId,
            },
          },
        });
        const warehouseActual = new Prisma.Decimal(warehouseBalance?.actualQty ?? 0);
        if (warehouseActual.lt(qty)) {
          throw new BadRequestException(
            `Cannot cancel Purchase Receipt ${input.voucherNo}: warehouse balance would go negative`,
          );
        }

        const binBalance = await tx.binBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId_locationId_batchId: {
              tenantId: input.tenantId,
              itemId: layer.itemId,
              warehouseId: layer.warehouseId,
              locationId: layer.locationId,
              batchId: layer.batchId ?? null,
            },
          },
        });
        const binActual = new Prisma.Decimal(binBalance?.actualQty ?? 0);
        if (binActual.lt(qty)) {
          throw new BadRequestException(
            `Cannot cancel Purchase Receipt ${input.voucherNo}: bin balance would go negative`,
          );
        }

        await tx.stockFifoLayer.update({
          where: { id: layer.id },
          data: { qtyRemaining: 0, isCancelled: true },
        });

        await this.updateWarehouseBalance(
          tx,
          input.tenantId,
          layer.itemId,
          layer.warehouseId,
          qty.neg(),
        );

        await tx.binBalance.update({
          where: { id: binBalance!.id },
          data: { actualQty: { decrement: qty } },
        });

        await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.cancelTs,
            postingDate: input.cancelTs,
            itemId: layer.itemId,
            warehouseId: layer.warehouseId,
            fromLocationId: layer.locationId,
            toLocationId: null,
            batchId: layer.batchId,
            fifoLayerId: layer.id,
            qty: qty.neg(),
            valuationRate: layer.incomingRate,
            stockValueDifference: qty.neg().mul(layer.incomingRate),
            voucherType: 'Purchase Receipt (Cancel)',
            voucherNo: input.voucherNo,
          },
        });
      }

      if (serialLinks.length > 0) {
        await tx.serial.deleteMany({
          where: { id: { in: serialLinks.map((s) => s.serialId) } },
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_CANCEL_RECEIPT', 'Purchase Receipt', input.voucherNo);
    });
  }

  async cancelDeliveryNote(input: {
    tenantId: string;
    voucherNo: string;
    cancelTs: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyCancelled = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: `CANCEL:Delivery Note:${input.voucherNo}`,
        voucherType: 'Delivery Note (Cancel)',
        voucherNo: input.voucherNo,
      });
      if (alreadyCancelled) return;

      const entries = await tx.stockLedgerEntry.findMany({
        where: {
          tenantId: input.tenantId,
          voucherType: 'Delivery Note',
          voucherNo: input.voucherNo,
        },
        include: { serials: true },
      });
      if (entries.length === 0) return;

      const issueEntries = entries.filter((e) => new Prisma.Decimal(e.qty).lt(0));
      if (issueEntries.length === 0) return;

      for (const entry of issueEntries) {
        if (!entry.fifoLayerId) {
          throw new BadRequestException(
            `Cannot cancel Delivery Note ${input.voucherNo}: missing FIFO layer references`,
          );
        }
        if (!entry.fromLocationId) {
          throw new BadRequestException(
            `Cannot cancel Delivery Note ${input.voucherNo}: missing fromLocationId`,
          );
        }
      }

      for (const entry of issueEntries) {
        const qtyAbs = new Prisma.Decimal(entry.qty).abs();
        const layer = await tx.stockFifoLayer.findUnique({ where: { id: entry.fifoLayerId! } });
        if (!layer || layer.isCancelled) {
          throw new BadRequestException(
            `Cannot cancel Delivery Note ${input.voucherNo}: FIFO layer unavailable`,
          );
        }

        const newRemaining = new Prisma.Decimal(layer.qtyRemaining).add(qtyAbs);
        if (newRemaining.gt(layer.qtyOriginal)) {
          throw new BadRequestException(
            `Cannot cancel Delivery Note ${input.voucherNo}: FIFO layer would exceed original quantity`,
          );
        }

        await tx.stockFifoLayer.update({
          where: { id: layer.id },
          data: { qtyRemaining: newRemaining },
        });

        await this.upsertWarehouseBalance(
          tx,
          input.tenantId,
          entry.itemId,
          entry.warehouseId,
          qtyAbs,
        );

        await this.upsertBinBalance(
          tx,
          input.tenantId,
          entry.itemId,
          entry.warehouseId,
          entry.fromLocationId!,
          entry.batchId,
          qtyAbs,
        );

        const legRate = new Prisma.Decimal(entry.stockValueDifference).abs().div(qtyAbs);

        const ledger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.cancelTs,
            postingDate: input.cancelTs,
            itemId: entry.itemId,
            warehouseId: entry.warehouseId,
            fromLocationId: null,
            toLocationId: entry.fromLocationId,
            batchId: entry.batchId,
            fifoLayerId: entry.fifoLayerId,
            qty: qtyAbs,
            valuationRate: legRate,
            stockValueDifference: qtyAbs.mul(legRate),
            voucherType: 'Delivery Note (Cancel)',
            voucherNo: input.voucherNo,
          },
        });

        if (entry.serials.length > 0) {
          const serialIds = entry.serials.map((s) => s.serialId);
          await tx.serial.updateMany({
            where: { id: { in: serialIds } },
            data: {
              status: 'AVAILABLE',
              warehouseId: entry.warehouseId,
              locationId: entry.fromLocationId,
              batchId: entry.batchId,
            },
          });
          await tx.stockLedgerEntrySerial.createMany({
            data: serialIds.map((serialId) => ({
              tenantId: input.tenantId,
              ledgerEntryId: ledger.id,
              serialId,
            })),
          });
        }
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_CANCEL_DELIVERY', 'Delivery Note', input.voucherNo);
    });
  }

  async cancelStockTransfer(input: {
    tenantId: string;
    voucherNo: string;
    cancelTs: Date;
    voucherType?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const voucherType = input.voucherType ?? 'Stock Transfer';
      const alreadyCancelled = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: `CANCEL:${voucherType}:${input.voucherNo}`,
        voucherType: `${voucherType} (Cancel)`,
        voucherNo: input.voucherNo,
      });
      if (alreadyCancelled) return;

      const destLayers = await tx.stockFifoLayer.findMany({
        where: {
          tenantId: input.tenantId,
          voucherType,
          voucherNo: input.voucherNo,
          isCancelled: false,
        },
      });
      if (destLayers.length === 0) return;

      for (const layer of destLayers) {
        if (layer.qtyRemaining.lt(layer.qtyOriginal)) {
          throw new BadRequestException(
            `Cannot cancel Stock Transfer ${input.voucherNo}: transferred stock already consumed`,
          );
        }
        if (!layer.sourceLayerId) {
          throw new BadRequestException(
            `Cannot cancel Stock Transfer ${input.voucherNo}: missing layer lineage`,
          );
        }
      }

      for (const layer of destLayers) {
        const qty = layer.qtyOriginal;

        await this.lockStock(tx, input.tenantId, layer.warehouseId, layer.itemId);
        const sourceLayer = await tx.stockFifoLayer.findUnique({
          where: { id: layer.sourceLayerId! },
        });
        if (!sourceLayer || sourceLayer.isCancelled) {
          throw new BadRequestException(
            `Cannot cancel Stock Transfer ${input.voucherNo}: source layer unavailable`,
          );
        }

        await this.lockStock(tx, input.tenantId, sourceLayer.warehouseId, sourceLayer.itemId);
        const sourceNewRemaining = new Prisma.Decimal(sourceLayer.qtyRemaining).add(qty);
        if (sourceNewRemaining.gt(sourceLayer.qtyOriginal)) {
          throw new BadRequestException(
            `Cannot cancel Stock Transfer ${input.voucherNo}: source layer would exceed original quantity`,
          );
        }

        const destWarehouseBalance = await tx.warehouseItemBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: input.tenantId,
              itemId: layer.itemId,
              warehouseId: layer.warehouseId,
            },
          },
        });
        const destActual = new Prisma.Decimal(destWarehouseBalance?.actualQty ?? 0);
        if (destActual.lt(qty)) {
          throw new BadRequestException(
            `Cannot cancel Stock Transfer ${input.voucherNo}: destination balance would go negative`,
          );
        }

        const destBinBalance = await tx.binBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId_locationId_batchId: {
              tenantId: input.tenantId,
              itemId: layer.itemId,
              warehouseId: layer.warehouseId,
              locationId: layer.locationId,
              batchId: layer.batchId ?? null,
            },
          },
        });
        const destBinActual = new Prisma.Decimal(destBinBalance?.actualQty ?? 0);
        if (destBinActual.lt(qty)) {
          throw new BadRequestException(
            `Cannot cancel Stock Transfer ${input.voucherNo}: destination bin would go negative`,
          );
        }

        await tx.stockFifoLayer.update({
          where: { id: layer.id },
          data: { qtyRemaining: 0, isCancelled: true },
        });

        await tx.stockFifoLayer.update({
          where: { id: sourceLayer.id },
          data: { qtyRemaining: sourceNewRemaining },
        });

        await this.updateWarehouseBalance(
          tx,
          input.tenantId,
          layer.itemId,
          layer.warehouseId,
          qty.neg(),
        );
        await this.upsertWarehouseBalance(
          tx,
          input.tenantId,
          sourceLayer.itemId,
          sourceLayer.warehouseId,
          qty,
        );

        await tx.binBalance.update({
          where: { id: destBinBalance!.id },
          data: { actualQty: { decrement: qty } },
        });

        await this.upsertBinBalance(
          tx,
          input.tenantId,
          sourceLayer.itemId,
          sourceLayer.warehouseId,
          sourceLayer.locationId,
          sourceLayer.batchId,
          qty,
        );

        const outLedger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.cancelTs,
            postingDate: input.cancelTs,
            itemId: layer.itemId,
            warehouseId: layer.warehouseId,
            fromLocationId: layer.locationId,
            toLocationId: null,
            batchId: layer.batchId,
            fifoLayerId: layer.id,
            qty: qty.neg(),
            valuationRate: layer.incomingRate,
            stockValueDifference: qty.neg().mul(layer.incomingRate),
            voucherType: `${voucherType} (Cancel)`,
            voucherNo: input.voucherNo,
          },
        });

        const inLedger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.cancelTs,
            postingDate: input.cancelTs,
            itemId: sourceLayer.itemId,
            warehouseId: sourceLayer.warehouseId,
            fromLocationId: null,
            toLocationId: sourceLayer.locationId,
            batchId: sourceLayer.batchId,
            fifoLayerId: sourceLayer.id,
            qty,
            valuationRate: sourceLayer.incomingRate,
            stockValueDifference: qty.mul(sourceLayer.incomingRate),
            voucherType: `${voucherType} (Cancel)`,
            voucherNo: input.voucherNo,
          },
        });

        const serialLinks = await tx.stockLedgerEntrySerial.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerEntry: {
              voucherType,
              voucherNo: input.voucherNo,
              fifoLayerId: sourceLayer.id,
            },
          },
          select: { serialId: true },
        });
        if (serialLinks.length > 0) {
          await tx.serial.updateMany({
            where: { id: { in: serialLinks.map((s) => s.serialId) } },
            data: {
              status: 'AVAILABLE',
              warehouseId: sourceLayer.warehouseId,
              locationId: sourceLayer.locationId,
              batchId: sourceLayer.batchId,
            },
          });
          await tx.stockLedgerEntrySerial.createMany({
            data: serialLinks.flatMap((s) => [
              { tenantId: input.tenantId, ledgerEntryId: outLedger.id, serialId: s.serialId },
              { tenantId: input.tenantId, ledgerEntryId: inLedger.id, serialId: s.serialId },
            ]),
          });
        }
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_CANCEL_TRANSFER', voucherType, input.voucherNo);
    });
  }

  async reserveStock(input: ReserveStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyPosted = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: input.postingKey,
        voucherType: input.voucherType,
        voucherNo: input.voucherNo,
      });
      if (alreadyPosted) return;

      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        undefined,
      );
      await this.lockStock(tx, input.tenantId, warehouse.id, item.id);

      const { stockQty } = await this.resolveStockQty(tx, {
        tenantId: input.tenantId,
        item,
        qty: input.qty,
        uomCode: input.uomCode,
        conversionFactor: input.conversionFactor,
      });
      const qty = stockQty;
      if (qty.lte(0)) throw new BadRequestException('qty must be > 0');

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
      if (available.lt(qty)) {
        throw new BadRequestException(
          `Insufficient available stock in warehouse ${warehouse.code} for item ${item.code}`,
        );
      }

      let locationId: string | undefined;
      if (input.locationCode) {
        const location = await tx.location.findUnique({
          where: {
            tenantId_warehouseId_code: {
              tenantId: input.tenantId,
              warehouseId: warehouse.id,
              code: input.locationCode,
            },
          },
        });
        if (!location) throw new BadRequestException(`Unknown location: ${input.locationCode}`);
        locationId = location.id;

        const locationAvailable = await this.getLocationAvailableQty(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId,
          batchId: batch?.id,
        });
        if (locationAvailable.lt(qty)) {
          throw new BadRequestException(
            `Insufficient available stock in location ${input.locationCode} for item ${item.code}`,
          );
        }
      }

      await tx.warehouseItemBalance.upsert({
        where: { tenantId_itemId_warehouseId: { tenantId: input.tenantId, itemId: item.id, warehouseId: warehouse.id } },
        update: { reservedQty: { increment: qty } },
        create: { tenantId: input.tenantId, itemId: item.id, warehouseId: warehouse.id, actualQty: 0, reservedQty: qty },
      });

      if (locationId) {
        await this.upsertBinReservation(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId,
          batchId: batch?.id,
          deltaQty: qty,
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_RESERVE', input.voucherType, input.voucherNo, {
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        qty: qty.toString(),
      });
    });
  }

  async unreserveStock(input: ReserveStockInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyPosted = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: input.postingKey,
        voucherType: input.voucherType,
        voucherNo: input.voucherNo,
      });
      if (alreadyPosted) return;

      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        undefined,
      );
      await this.lockStock(tx, input.tenantId, warehouse.id, item.id);

      const { stockQty } = await this.resolveStockQty(tx, {
        tenantId: input.tenantId,
        item,
        qty: input.qty,
        uomCode: input.uomCode,
        conversionFactor: input.conversionFactor,
      });
      const qty = stockQty;
      if (qty.lte(0)) throw new BadRequestException('qty must be > 0');

      const warehouseBalance = await tx.warehouseItemBalance.findUnique({
        where: {
          tenantId_itemId_warehouseId: {
            tenantId: input.tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
          },
        },
      });
      const reserved = new Prisma.Decimal(warehouseBalance?.reservedQty ?? 0);
      if (reserved.lt(qty)) {
        throw new BadRequestException(
          `Reserved qty would go negative for item ${item.code} in warehouse ${warehouse.code}`,
        );
      }

      let locationId: string | undefined;
      if (input.locationCode) {
        const location = await tx.location.findUnique({
          where: {
            tenantId_warehouseId_code: {
              tenantId: input.tenantId,
              warehouseId: warehouse.id,
              code: input.locationCode,
            },
          },
        });
        if (!location) throw new BadRequestException(`Unknown location: ${input.locationCode}`);
        locationId = location.id;

        const binBalance = await tx.binBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId_locationId_batchId: {
              tenantId: input.tenantId,
              itemId: item.id,
              warehouseId: warehouse.id,
              locationId,
              batchId: batch?.id ?? null,
            },
          },
        });
        const reservedInBin = new Prisma.Decimal(binBalance?.reservedQty ?? 0);
        if (reservedInBin.lt(qty)) {
          throw new BadRequestException(
            `Reserved qty would go negative for item ${item.code} in location ${input.locationCode}`,
          );
        }
      }

      await tx.warehouseItemBalance.update({
        where: { tenantId_itemId_warehouseId: { tenantId: input.tenantId, itemId: item.id, warehouseId: warehouse.id } },
        data: { reservedQty: { decrement: qty } },
      });

      if (locationId) {
        await this.upsertBinReservation(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId,
          batchId: batch?.id,
          deltaQty: qty.neg(),
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_UNRESERVE', input.voucherType, input.voucherNo, {
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        qty: qty.toString(),
      });
    });
  }

  async reconcileStock(input: VoucherRef & {
    tenantId: string;
    postingKey: string;
    itemCode: string;
    warehouseCode: string;
    locationCode: string;
    batchNo?: string;
    serialNos?: string[] | string;
    uomCode?: string;
    conversionFactor?: Prisma.Decimal | number | string;
    targetQty: Prisma.Decimal | number | string;
    increaseRate?: Prisma.Decimal | number | string;
    strategy?: StockConsumptionStrategy;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, input.tenantId);
      const alreadyPosted = await this.createPostingMarker(tx, {
        tenantId: input.tenantId,
        postingKey: input.postingKey,
        voucherType: input.voucherType,
        voucherNo: input.voucherNo,
      });
      if (alreadyPosted) return;

      const tenant = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { stockConsumptionStrategy: true, allowNegativeStock: true },
      });
      if (!tenant) throw new BadRequestException('Invalid tenant');

      const { item, warehouse, batch } = await this.resolveItemWarehouseBatch(
        tx,
        input.tenantId,
        input.itemCode,
        input.warehouseCode,
        input.batchNo,
        undefined,
      );
      await this.lockStock(tx, input.tenantId, warehouse.id, item.id);

      const location = await tx.location.findUnique({
        where: {
          tenantId_warehouseId_code: {
            tenantId: input.tenantId,
            warehouseId: warehouse.id,
            code: input.locationCode,
          },
        },
      });
      if (!location) throw new BadRequestException(`Unknown location: ${input.locationCode}`);

      const { stockQty, conversionFactor } = await this.resolveStockQty(tx, {
        tenantId: input.tenantId,
        item,
        qty: input.targetQty,
        uomCode: input.uomCode,
        conversionFactor: input.conversionFactor,
      });
      const targetQty = stockQty;
      if (targetQty.lt(0)) throw new BadRequestException('targetQty must be >= 0');

      const serials = this.parseSerials(input.serialNos);

      const current = await tx.binBalance.findUnique({
        where: {
          tenantId_itemId_warehouseId_locationId_batchId: {
            tenantId: input.tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: location.id,
            batchId: batch?.id ?? null,
          },
        },
      });
      const currentQty = new Prisma.Decimal(current?.actualQty ?? 0);
      const delta = targetQty.sub(currentQty);
      if (delta.eq(0)) return;

      if (delta.gt(0)) {
        if (item.hasSerial) {
          this.ensureUniqueSerials(serials);
          this.ensureSerialQty(delta, serials.length);
          await this.ensureSerialsAvailable(tx, input.tenantId, item.id, serials);
        } else if (serials.length > 0) {
          throw new BadRequestException(`Item ${item.code} is not serial-tracked`);
        }

        const rate = new Prisma.Decimal(input.increaseRate ?? 0);
        if (rate.lt(0)) throw new BadRequestException('increaseRate must be >= 0');
        const stockRate = this.resolveStockRate(rate, conversionFactor);
        await this.upsertWarehouseBalance(tx, input.tenantId, item.id, warehouse.id, delta);
        await this.upsertBinBalance(
          tx,
          input.tenantId,
          item.id,
          warehouse.id,
          location.id,
          batch?.id,
          delta,
        );

        const layer = await tx.stockFifoLayer.create({
          data: {
            tenantId: input.tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: location.id,
            batchId: batch?.id,
            postingTs: input.postingTs,
            qtyOriginal: delta,
            qtyRemaining: delta,
            incomingRate: stockRate,
            isCancelled: false,
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        const ledger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.postingTs,
            postingDate: input.postingTs,
            itemId: item.id,
            warehouseId: warehouse.id,
            fromLocationId: null,
            toLocationId: location.id,
            batchId: batch?.id,
            fifoLayerId: layer.id,
            qty: delta,
            valuationRate: stockRate,
            stockValueDifference: delta.mul(stockRate),
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        if (item.hasSerial && serials.length > 0) {
          const created = await tx.serial.createMany({
            data: serials.map((serialNo) => ({
              tenantId: input.tenantId,
              itemId: item.id,
              serialNo,
              status: 'AVAILABLE',
              warehouseId: warehouse.id,
              locationId: location.id,
              batchId: batch?.id,
            })),
          });
          if (created.count !== serials.length) {
            throw new BadRequestException('Failed to create all serials');
          }
          const serialRows = await tx.serial.findMany({
            where: { tenantId: input.tenantId, serialNo: { in: serials } },
            select: { id: true },
          });
          await tx.stockLedgerEntrySerial.createMany({
            data: serialRows.map((s) => ({
              tenantId: input.tenantId,
              ledgerEntryId: ledger.id,
              serialId: s.id,
            })),
          });
        }
        await this.logAudit(tx, input.tenantId, 'STOCK_RECONCILE_INCREASE', input.voucherType, input.voucherNo, {
          itemCode: input.itemCode,
          warehouseCode: input.warehouseCode,
          locationCode: input.locationCode,
          qty: delta.toString(),
        });
        return;
      }

      const qtyToReduce = delta.abs();

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
      if (!tenant.allowNegativeStock && available.lt(qtyToReduce)) {
        throw new BadRequestException(
          `Insufficient available stock in warehouse ${warehouse.code} for item ${item.code}`,
        );
      }

      // Reconciliation is per-location; ensure location has enough quantity.
      if (!tenant.allowNegativeStock && currentQty.lt(qtyToReduce)) {
        throw new BadRequestException(
          `Insufficient stock in location ${input.locationCode} for item ${item.code}`,
        );
      }

      if (!tenant.allowNegativeStock) {
        const locationAvailable = await this.getLocationAvailableQty(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          warehouseId: warehouse.id,
          locationId: location.id,
          batchId: batch?.id,
        });
        if (locationAvailable.lt(qtyToReduce)) {
          throw new BadRequestException(
            `Insufficient available stock in location ${input.locationCode} for item ${item.code}`,
          );
        }
      }

      if (item.hasSerial) {
        this.ensureUniqueSerials(serials);
        this.ensureSerialQty(qtyToReduce, serials.length);
        await this.ensureSerialsInLocation(tx, {
          tenantId: input.tenantId,
          itemId: item.id,
          serialNos: serials,
          warehouseId: warehouse.id,
          locationId: location.id,
          batchId: batch?.id,
        });
      } else if (serials.length > 0) {
        throw new BadRequestException(`Item ${item.code} is not serial-tracked`);
      }

      const strategy = input.strategy ?? tenant.stockConsumptionStrategy;
      const consumption = await this.consumeFifoLayers(tx, {
        tenantId: input.tenantId,
        itemId: item.id,
        warehouseId: warehouse.id,
        locationId: location.id,
        batchId: batch?.id,
        qty: qtyToReduce,
        strategy,
      });

      const valuationRate = consumption.totalCost.div(qtyToReduce);
      await this.updateWarehouseBalance(
        tx,
        input.tenantId,
        item.id,
        warehouse.id,
        qtyToReduce.neg(),
      );

      const serialQueue = [...serials];
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

        const ledger = await tx.stockLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            postingTs: input.postingTs,
            postingDate: input.postingTs,
            itemId: item.id,
            warehouseId: warehouse.id,
            fromLocationId: leg.locationId,
            toLocationId: null,
            batchId: batch?.id ?? leg.batchId,
            fifoLayerId: leg.layerId,
            qty: leg.qty.neg(),
            valuationRate,
            stockValueDifference: leg.qty.neg().mul(leg.rate),
            voucherType: input.voucherType,
            voucherNo: input.voucherNo,
          },
        });

        if (item.hasSerial && serialQueue.length > 0) {
          const takeCount = leg.qty.toNumber();
          const legSerials = serialQueue.splice(0, takeCount);
          const serialRows = await tx.serial.findMany({
            where: { tenantId: input.tenantId, serialNo: { in: legSerials } },
            select: { id: true },
          });
          await tx.stockLedgerEntrySerial.createMany({
            data: serialRows.map((s) => ({
              tenantId: input.tenantId,
              ledgerEntryId: ledger.id,
              serialId: s.id,
            })),
          });
        }
      }
      if (item.hasSerial && serialQueue.length !== 0) {
        throw new BadRequestException('Serial allocation mismatch for reconciliation');
      }

      if (item.hasSerial && serials.length > 0) {
        await tx.serial.updateMany({
          where: { tenantId: input.tenantId, serialNo: { in: serials } },
          data: { status: 'ISSUED', warehouseId: null, locationId: null },
        });
      }

      await this.logAudit(tx, input.tenantId, 'STOCK_RECONCILE_DECREASE', input.voucherType, input.voucherNo, {
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        locationCode: input.locationCode,
        qty: qtyToReduce.toString(),
      });
    });
  }

  private async setTenant(tx: PrismaClient, tenantId: string) {
    await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
  }

  private async logAudit(
    tx: PrismaClient,
    tenantId: string,
    action: string,
    docType: string,
    docName: string,
    meta?: Record<string, any>,
  ) {
    if (!docName) return;
    await tx.auditLog.create({
      data: {
        tenantId,
        action,
        docType,
        docName,
        meta: meta ?? undefined,
      },
    });
  }

  private async lockStock(tx: PrismaClient, tenantId: string, warehouseId: string, itemId: string) {
    const key = `${tenantId}:${warehouseId}:${itemId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  private parseSerials(input?: string[] | string) {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((s) => s.trim()).filter(Boolean);
    }
    return input
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async resolveStockQty(
    tx: PrismaClient,
    input: {
      tenantId: string;
      item: { id: string; code: string; stockUomCode?: string | null };
      qty: Prisma.Decimal | number | string;
      uomCode?: string;
      conversionFactor?: Prisma.Decimal | number | string;
    },
  ) {
    const qty = new Prisma.Decimal(input.qty);
    if (!input.uomCode) {
      return { stockQty: qty, conversionFactor: new Prisma.Decimal(1) };
    }

    if (input.item.stockUomCode && input.uomCode === input.item.stockUomCode) {
      return { stockQty: qty, conversionFactor: new Prisma.Decimal(1) };
    }

    let factor: Prisma.Decimal | null = null;
    if (input.conversionFactor !== undefined && input.conversionFactor !== null) {
      factor = new Prisma.Decimal(input.conversionFactor);
    } else {
      const itemUom = await tx.itemUom.findUnique({
        where: {
          tenantId_itemId_uomCode: {
            tenantId: input.tenantId,
            itemId: input.item.id,
            uomCode: input.uomCode,
          },
        },
      });
      if (!itemUom || !itemUom.isActive) {
        throw new BadRequestException(
          `Missing UOM conversion for item ${input.item.code} and UOM ${input.uomCode}`,
        );
      }
      factor = itemUom.conversionFactor;
    }

    if (!factor || factor.lte(0)) {
      throw new BadRequestException('conversionFactor must be > 0');
    }

    return { stockQty: qty.mul(factor), conversionFactor: factor };
  }

  private resolveStockRate(rate: Prisma.Decimal, conversionFactor?: Prisma.Decimal | null) {
    if (!conversionFactor || conversionFactor.eq(1)) return rate;
    return rate.div(conversionFactor);
  }

  private ensureSerialQty(qty: Prisma.Decimal, serialCount: number) {
    if (!qty.mod(1).eq(0)) {
      throw new BadRequestException('Serial-tracked qty must be an integer');
    }
    if (serialCount !== qty.toNumber()) {
      throw new BadRequestException('Serial count must match quantity');
    }
  }

  private ensureUniqueSerials(serials: string[]) {
    if (serials.length === 0) return;
    const unique = new Set(serials);
    if (unique.size !== serials.length) {
      throw new BadRequestException('Duplicate serial numbers provided');
    }
  }

  private async ensureSerialsAvailable(
    tx: PrismaClient,
    tenantId: string,
    itemId: string,
    serialNos: string[],
  ) {
    if (serialNos.length === 0) return;
    const existing = await tx.serial.findMany({
      where: { tenantId, serialNo: { in: serialNos } },
      select: { serialNo: true },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        `Serials already exist: ${existing.map((s) => s.serialNo).join(', ')}`,
      );
    }
  }

  private async ensureSerialsInLocation(
    tx: PrismaClient,
    input: {
      tenantId: string;
      itemId: string;
      serialNos: string[];
      warehouseId: string;
      locationId?: string;
      batchId?: string;
    },
  ) {
    if (input.serialNos.length === 0) return;
    const serials = await tx.serial.findMany({
      where: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        serialNo: { in: input.serialNos },
        status: 'AVAILABLE',
        warehouseId: input.warehouseId,
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
      select: { serialNo: true },
    });
    if (serials.length !== input.serialNos.length) {
      throw new BadRequestException('One or more serials are not available in the specified location');
    }
  }

  private async createPostingMarker(
    tx: PrismaClient,
    input: { tenantId: string; postingKey: string; voucherType: string; voucherNo: string },
  ) {
    try {
      await tx.stockPosting.create({
        data: {
          tenantId: input.tenantId,
          postingKey: input.postingKey,
          voucherType: input.voucherType,
          voucherNo: input.voucherNo,
        },
      });
      return false;
    } catch (e: any) {
      if (e?.code === 'P2002') return true;
      throw e;
    }
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
        reservedQty: 0,
      },
    });
  }

  private async upsertBinReservation(
    tx: PrismaClient,
    input: {
      tenantId: string;
      itemId: string;
      warehouseId: string;
      locationId: string;
      batchId?: string;
      deltaQty: Prisma.Decimal;
    },
  ) {
    await tx.binBalance.upsert({
      where: {
        tenantId_itemId_warehouseId_locationId_batchId: {
          tenantId: input.tenantId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          batchId: input.batchId ?? null,
        },
      },
      update: { reservedQty: { increment: input.deltaQty } },
      create: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        batchId: input.batchId ?? null,
        actualQty: 0,
        reservedQty: input.deltaQty,
      },
    });
  }

  private async getLocationAvailableQty(
    tx: PrismaClient,
    input: {
      tenantId: string;
      itemId: string;
      warehouseId: string;
      locationId: string;
      batchId?: string;
      includeReserved?: boolean;
    },
  ) {
    const result = await tx.binBalance.aggregate({
      where: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
      _sum: { actualQty: true, reservedQty: true },
    });
    const actual = new Prisma.Decimal(result._sum.actualQty ?? 0);
    const reserved = new Prisma.Decimal(result._sum.reservedQty ?? 0);
    return input.includeReserved ? actual : actual.sub(reserved);
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
