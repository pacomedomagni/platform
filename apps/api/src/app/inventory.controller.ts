import { Controller, Get, Query, Req, UseGuards, BadRequestException, ForbiddenException, Post, Body, Put, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService, Prisma } from '@platform/db';
import { SerialStatus } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '@platform/auth';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  private ensureInventoryAccess(user: AuthenticatedUser) {
    const roles: string[] = user?.roles || [];
    const allowed = new Set(['System Manager', 'Stock Manager', 'Accounts Manager', 'user', 'admin']);
    if (!roles.some((role) => allowed.has(role))) {
      throw new ForbiddenException('Insufficient permissions for inventory access');
    }
  }

  @Get('stock-balance')
  async getStockBalance(
    @Req() req: RequestWithUser,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('itemCode') itemCode?: string,
    @Query('locationCode') locationCode?: string,
    @Query('batchNo') batchNo?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      if (batchNo && !item) {
        throw new BadRequestException('batchNo requires itemCode');
      }

      if (locationCode) {
        if (!warehouse) throw new BadRequestException('locationCode requires warehouseCode');
        const location = await tx.location.findUnique({
          where: {
            tenantId_warehouseId_code: { tenantId, warehouseId: warehouse.id, code: locationCode },
          },
        });
        if (!location) throw new BadRequestException(`Unknown location: ${locationCode}`);

        const batch = batchNo
          ? await tx.batch.findUnique({
              where: {
                tenantId_itemId_batchNo: {
                  tenantId,
                  itemId: item!.id,
                  batchNo,
                },
              },
            })
          : null;
        if (batchNo && !batch) throw new BadRequestException(`Unknown batch: ${batchNo}`);

        const balances = await tx.binBalance.findMany({
          where: {
            ...(item ? { itemId: item.id } : {}),
            warehouseId: warehouse.id,
            locationId: location.id,
            ...(batch ? { batchId: batch.id } : {}),
          },
          include: { item: true, warehouse: true, location: true, batch: true },
        });

        return balances.map((b) => ({
          itemCode: b.item.code,
          warehouseCode: b.warehouse.code,
          locationCode: b.location.code,
          batchNo: b.batch?.batchNo ?? null,
          actualQty: b.actualQty,
          reservedQty: b.reservedQty,
          availableQty: b.actualQty.minus(b.reservedQty),
        }));
      }

      const balances = await tx.warehouseItemBalance.findMany({
        where: {
          ...(item ? { itemId: item.id } : {}),
          ...(warehouse ? { warehouseId: warehouse.id } : {}),
        },
        include: { item: true, warehouse: true },
      });

      return balances.map((b) => ({
        itemCode: b.item.code,
        warehouseCode: b.warehouse.code,
        actualQty: b.actualQty,
        reservedQty: b.reservedQty,
        availableQty: b.actualQty.minus(b.reservedQty),
      }));
    });
  }

  @Get('stock-ledger')
  async getStockLedger(
    @Req() req: RequestWithUser,
    @Query('itemCode') itemCode?: string,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('batchNo') batchNo?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const batch = batchNo
        ? await tx.batch.findUnique({
            where: {
              tenantId_itemId_batchNo: {
                tenantId,
                itemId: item?.id ?? 'missing',
                batchNo,
              },
            },
          })
        : null;
      if (batchNo && (!item || !batch)) {
        throw new BadRequestException('batchNo requires a valid itemCode');
      }

      const where: Prisma.StockLedgerEntryWhereInput = {
        tenantId,
        ...(item ? { itemId: item.id } : {}),
        ...(warehouse ? { warehouseId: warehouse.id } : {}),
        ...(batch ? { batchId: batch.id } : {}),
      };
      if (fromDate || toDate) {
        where.postingDate = {};
        if (fromDate) where.postingDate.gte = new Date(fromDate);
        if (toDate) where.postingDate.lte = new Date(toDate);
      }

      const entries = await tx.stockLedgerEntry.findMany({
        where,
        orderBy: { postingTs: 'asc' },
        include: {
          item: true,
          warehouse: true,
          fromLocation: true,
          toLocation: true,
          batch: true,
        },
      });

      return entries.map((e) => ({
        postingTs: e.postingTs,
        itemCode: e.item.code,
        warehouseCode: e.warehouse.code,
        fromLocation: e.fromLocation?.code ?? null,
        toLocation: e.toLocation?.code ?? null,
        batchNo: e.batch?.batchNo ?? null,
        qty: e.qty,
        valuationRate: e.valuationRate,
        stockValueDifference: e.stockValueDifference,
        voucherType: e.voucherType,
        voucherNo: e.voucherNo,
      }));
    });
  }

  @Get('locations')
  async listLocations(@Req() req: RequestWithUser, @Query('warehouseCode') warehouseCode?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const locations = await tx.location.findMany({
        where: {
          ...(warehouse ? { warehouseId: warehouse.id } : {}),
          isActive: true,
        },
        orderBy: [{ warehouseId: 'asc' }, { path: 'asc' }],
      });

      return locations.map((loc) => ({
        code: loc.code,
        name: loc.name,
        path: loc.path,
        warehouseId: loc.warehouseId,
        isPickable: loc.isPickable,
        isPutaway: loc.isPutaway,
        isStaging: loc.isStaging,
        isActive: loc.isActive,
      }));
    });
  }

  @Get('serials')
  async listSerials(
    @Req() req: RequestWithUser,
    @Query('itemCode') itemCode?: string,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const serials = await tx.serial.findMany({
        where: {
          ...(item ? { itemId: item.id } : {}),
          ...(warehouse ? { warehouseId: warehouse.id } : {}),
          ...(status ? { status: status as SerialStatus } : {}),
        },
        orderBy: { serialNo: 'asc' },
      });

      // Fetch related entities separately to avoid include type issues
      const itemIds = [...new Set(serials.map((s) => s.itemId))];
      const warehouseIds = [...new Set(serials.map((s) => s.warehouseId).filter(Boolean))] as string[];
      const locationIds = [...new Set(serials.map((s) => s.locationId).filter(Boolean))] as string[];
      const batchIds = [...new Set(serials.map((s) => s.batchId).filter(Boolean))] as string[];

      const [items, warehouses, locations, batches] = await Promise.all([
        tx.item.findMany({ where: { id: { in: itemIds } } }),
        warehouseIds.length > 0 ? tx.warehouse.findMany({ where: { id: { in: warehouseIds } } }) : [],
        locationIds.length > 0 ? tx.location.findMany({ where: { id: { in: locationIds } } }) : [],
        batchIds.length > 0 ? tx.batch.findMany({ where: { id: { in: batchIds } } }) : [],
      ]);

      const itemMap = new Map<string, typeof items[0]>(items.map((i) => [i.id, i] as const));
      const warehouseMap = new Map<string, typeof warehouses[0]>(warehouses.map((w) => [w.id, w] as const));
      const locationMap = new Map<string, typeof locations[0]>(locations.map((l) => [l.id, l] as const));
      const batchMap = new Map<string, typeof batches[0]>(batches.map((b) => [b.id, b] as const));

      return serials.map((s) => ({
        serialNo: s.serialNo,
        itemCode: itemMap.get(s.itemId)?.code ?? s.itemId,
        warehouseCode: s.warehouseId ? warehouseMap.get(s.warehouseId)?.code ?? null : null,
        locationCode: s.locationId ? locationMap.get(s.locationId)?.code ?? null : null,
        batchNo: s.batchId ? batchMap.get(s.batchId)?.batchNo ?? null : null,
        status: s.status,
      }));
    });
  }

  @Get('stock-valuation')
  async getStockValuation(
    @Req() req: RequestWithUser,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('itemCode') itemCode?: string,
    @Query('locationCode') locationCode?: string,
    @Query('batchNo') batchNo?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      if (batchNo && !item) {
        throw new BadRequestException('batchNo requires itemCode');
      }

      let locationId: string | undefined;
      if (locationCode) {
        if (!warehouse) throw new BadRequestException('locationCode requires warehouseCode');
        const location = await tx.location.findUnique({
          where: {
            tenantId_warehouseId_code: { tenantId, warehouseId: warehouse.id, code: locationCode },
          },
        });
        if (!location) throw new BadRequestException(`Unknown location: ${locationCode}`);
        locationId = location.id;
      }

      const batch = batchNo
        ? await tx.batch.findUnique({
            where: {
              tenantId_itemId_batchNo: {
                tenantId,
                itemId: item!.id,
                batchNo,
              },
            },
          })
        : null;
      if (batchNo && !batch) throw new BadRequestException(`Unknown batch: ${batchNo}`);

      const layers = await tx.stockFifoLayer.findMany({
        where: {
          tenantId,
          isCancelled: false,
          qtyRemaining: { gt: 0 },
          ...(item ? { itemId: item.id } : {}),
          ...(warehouse ? { warehouseId: warehouse.id } : {}),
          ...(locationId ? { locationId } : {}),
          ...(batch ? { batchId: batch.id } : {}),
        },
        select: {
          itemId: true,
          warehouseId: true,
          locationId: true,
          batchId: true,
          qtyRemaining: true,
          incomingRate: true,
        },
      });

      const grouped = new Map<
        string,
        { itemId: string; warehouseId: string; locationId: string; batchId: string | null; qty: Prisma.Decimal; value: Prisma.Decimal }
      >();

      for (const layer of layers) {
        const key = `${layer.itemId}:${layer.warehouseId}:${layer.locationId}:${layer.batchId ?? 'null'}`;
        const existing = grouped.get(key);
        const qty = new Prisma.Decimal(layer.qtyRemaining);
        const value = qty.mul(layer.incomingRate);
        if (existing) {
          existing.qty = existing.qty.add(qty);
          existing.value = existing.value.add(value);
        } else {
          grouped.set(key, {
            itemId: layer.itemId,
            warehouseId: layer.warehouseId,
            locationId: layer.locationId,
            batchId: layer.batchId ?? null,
            qty,
            value,
          });
        }
      }

      const itemIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.itemId)));
      const warehouseIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.warehouseId)));
      const locationIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.locationId)));
      const batchIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.batchId).filter(Boolean))) as string[];

      const [items, warehouses, locations, batches] = await Promise.all([
        tx.item.findMany({ where: { id: { in: itemIds } } }),
        tx.warehouse.findMany({ where: { id: { in: warehouseIds } } }),
        tx.location.findMany({ where: { id: { in: locationIds } } }),
        batchIds.length > 0 ? tx.batch.findMany({ where: { id: { in: batchIds } } }) : [],
      ]);

      const itemMap = new Map<string, string>(items.map((i) => [i.id, i.code] as [string, string]));
      const warehouseMap = new Map<string, string>(warehouses.map((w) => [w.id, w.code] as [string, string]));
      const locationMap = new Map<string, string>(locations.map((l) => [l.id, l.code] as [string, string]));
      const batchMap = new Map<string, string>(batches.map((b) => [b.id, b.batchNo] as [string, string]));

      return Array.from(grouped.values()).map((g) => ({
        itemCode: itemMap.get(g.itemId) ?? g.itemId,
        warehouseCode: warehouseMap.get(g.warehouseId) ?? g.warehouseId,
        locationCode: locationMap.get(g.locationId) ?? g.locationId,
        batchNo: g.batchId ? batchMap.get(g.batchId) ?? g.batchId : null,
        qty: g.qty,
        stockValue: g.value,
        avgRate: g.qty.gt(0) ? g.value.div(g.qty) : new Prisma.Decimal(0),
      }));
    });
  }

  @Get('stock-aging')
  async getStockAging(
    @Req() req: RequestWithUser,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('itemCode') itemCode?: string,
    @Query('locationCode') locationCode?: string,
    @Query('batchNo') batchNo?: string,
    @Query('asOfDate') asOfDate?: string,
    @Query('bucketDays') bucketDays?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      if (batchNo && !item) {
        throw new BadRequestException('batchNo requires itemCode');
      }

      let locationId: string | undefined;
      if (locationCode) {
        if (!warehouse) throw new BadRequestException('locationCode requires warehouseCode');
        const location = await tx.location.findUnique({
          where: {
            tenantId_warehouseId_code: { tenantId, warehouseId: warehouse.id, code: locationCode },
          },
        });
        if (!location) throw new BadRequestException(`Unknown location: ${locationCode}`);
        locationId = location.id;
      }

      const batch = batchNo
        ? await tx.batch.findUnique({
            where: {
              tenantId_itemId_batchNo: {
                tenantId,
                itemId: item!.id,
                batchNo,
              },
            },
          })
        : null;
      if (batchNo && !batch) throw new BadRequestException(`Unknown batch: ${batchNo}`);

      const asOf = asOfDate ? new Date(asOfDate) : new Date();
      if (Number.isNaN(asOf.getTime())) {
        throw new BadRequestException('Invalid asOfDate');
      }

      const boundaries = bucketDays
        ? bucketDays
            .split(',')
            .map((v) => parseInt(v.trim(), 10))
            .filter((v) => Number.isFinite(v) && v > 0)
            .sort((a, b) => a - b)
        : [30, 60, 90];

      const layers = await tx.stockFifoLayer.findMany({
        where: {
          tenantId,
          isCancelled: false,
          qtyRemaining: { gt: 0 },
          ...(item ? { itemId: item.id } : {}),
          ...(warehouse ? { warehouseId: warehouse.id } : {}),
          ...(locationId ? { locationId } : {}),
          ...(batch ? { batchId: batch.id } : {}),
        },
        select: {
          itemId: true,
          warehouseId: true,
          locationId: true,
          batchId: true,
          qtyRemaining: true,
          incomingRate: true,
          postingTs: true,
        },
      });

      const bucketLabels: string[] = [];
      let prev = 0;
      for (const boundary of boundaries) {
        bucketLabels.push(`${prev}-${boundary}`);
        prev = boundary + 1;
      }
      bucketLabels.push(`${prev}+`);

      type BucketRow = {
        itemId: string;
        warehouseId: string;
        locationId: string;
        batchId: string | null;
        buckets: { qty: Prisma.Decimal; value: Prisma.Decimal }[];
      };

      const grouped = new Map<string, BucketRow>();
      for (const layer of layers) {
        const key = `${layer.itemId}:${layer.warehouseId}:${layer.locationId}:${layer.batchId ?? 'null'}`;
        let row = grouped.get(key);
        if (!row) {
          row = {
            itemId: layer.itemId,
            warehouseId: layer.warehouseId,
            locationId: layer.locationId,
            batchId: layer.batchId ?? null,
            buckets: bucketLabels.map(() => ({
              qty: new Prisma.Decimal(0),
              value: new Prisma.Decimal(0),
            })),
          };
          grouped.set(key, row);
        }

        const ageDays = Math.floor((asOf.getTime() - new Date(layer.postingTs).getTime()) / 86400000);
        const idx = boundaries.findIndex((b) => ageDays <= b);
        const bucketIndex = idx === -1 ? bucketLabels.length - 1 : idx;

        const qty = new Prisma.Decimal(layer.qtyRemaining);
        const value = qty.mul(layer.incomingRate);
        row.buckets[bucketIndex].qty = row.buckets[bucketIndex].qty.add(qty);
        row.buckets[bucketIndex].value = row.buckets[bucketIndex].value.add(value);
      }

      const itemIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.itemId)));
      const warehouseIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.warehouseId)));
      const locationIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.locationId)));
      const batchIds = Array.from(new Set(Array.from(grouped.values()).map((g) => g.batchId).filter(Boolean))) as string[];

      const [items, warehouses, locations, batches] = await Promise.all([
        tx.item.findMany({ where: { id: { in: itemIds } } }),
        tx.warehouse.findMany({ where: { id: { in: warehouseIds } } }),
        tx.location.findMany({ where: { id: { in: locationIds } } }),
        batchIds.length > 0 ? tx.batch.findMany({ where: { id: { in: batchIds } } }) : [],
      ]);

      const itemMap = new Map<string, string>(items.map((i) => [i.id, i.code] as [string, string]));
      const warehouseMap = new Map<string, string>(warehouses.map((w) => [w.id, w.code] as [string, string]));
      const locationMap = new Map<string, string>(locations.map((l) => [l.id, l.code] as [string, string]));
      const batchMap = new Map<string, string>(batches.map((b) => [b.id, b.batchNo] as [string, string]));

      return Array.from(grouped.values()).map((g) => ({
        itemCode: itemMap.get(g.itemId) ?? g.itemId,
        warehouseCode: warehouseMap.get(g.warehouseId) ?? g.warehouseId,
        locationCode: locationMap.get(g.locationId) ?? g.locationId,
        batchNo: g.batchId ? batchMap.get(g.batchId) ?? g.batchId : null,
        buckets: g.buckets.map((b, idx) => ({
          label: bucketLabels[idx],
          qty: b.qty,
          stockValue: b.value,
        })),
      }));
    });
  }

  @Get('stock-movement')
  async getStockMovement(
    @Req() req: RequestWithUser,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('itemCode') itemCode?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const where: Prisma.StockLedgerEntryWhereInput = {
        tenantId,
        ...(item ? { itemId: item.id } : {}),
        ...(warehouse ? { warehouseId: warehouse.id } : {}),
      };
      if (fromDate || toDate) {
        where.postingDate = {};
        if (fromDate) where.postingDate.gte = new Date(fromDate);
        if (toDate) where.postingDate.lte = new Date(toDate);
      }

      const entries = await tx.stockLedgerEntry.findMany({
        where,
        include: { item: true, warehouse: true },
      });

      const grouped = new Map<
        string,
        { itemCode: string; warehouseCode: string; inQty: Prisma.Decimal; outQty: Prisma.Decimal; netQty: Prisma.Decimal; stockValue: Prisma.Decimal }
      >();

      for (const entry of entries) {
        const key = `${entry.itemId}:${entry.warehouseId}`;
        const existing = grouped.get(key);
        const qty = new Prisma.Decimal(entry.qty);
        const value = new Prisma.Decimal(entry.stockValueDifference);
        const inQty = qty.gt(0) ? qty : new Prisma.Decimal(0);
        const outQty = qty.lt(0) ? qty.abs() : new Prisma.Decimal(0);
        if (existing) {
          existing.inQty = existing.inQty.add(inQty);
          existing.outQty = existing.outQty.add(outQty);
          existing.netQty = existing.netQty.add(qty);
          existing.stockValue = existing.stockValue.add(value);
        } else {
          grouped.set(key, {
            itemCode: entry.item.code,
            warehouseCode: entry.warehouse.code,
            inQty,
            outQty,
            netQty: qty,
            stockValue: value,
          });
        }
      }

      return Array.from(grouped.values());
    });
  }

  @Get('reorder-suggestions')
  async getReorderSuggestions(
    @Req() req: RequestWithUser,
    @Query('warehouseCode') warehouseCode?: string,
    @Query('itemCode') itemCode?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    this.ensureInventoryAccess(req.user);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;

      const warehouse = warehouseCode
        ? await tx.warehouse.findUnique({
            where: { tenantId_code: { tenantId, code: warehouseCode } },
          })
        : null;
      if (warehouseCode && !warehouse) throw new BadRequestException(`Unknown warehouse: ${warehouseCode}`);

      const item = itemCode
        ? await tx.item.findUnique({ where: { tenantId_code: { tenantId, code: itemCode } } })
        : null;
      if (itemCode && !item) throw new BadRequestException(`Unknown item: ${itemCode}`);

      const balances = await tx.warehouseItemBalance.findMany({
        where: {
          ...(warehouse ? { warehouseId: warehouse.id } : {}),
          ...(item ? { itemId: item.id } : {}),
        },
        include: { item: true, warehouse: true },
      });

      return balances
        .map((b) => {
          const reorderLevel = b.item.reorderLevel ? new Prisma.Decimal(b.item.reorderLevel) : null;
          const reorderQty = b.item.reorderQty ? new Prisma.Decimal(b.item.reorderQty) : null;
          const availableQty = b.actualQty.minus(b.reservedQty);
          const shouldReorder = reorderLevel ? availableQty.lte(reorderLevel) : false;
          return {
            itemCode: b.item.code,
            warehouseCode: b.warehouse.code,
            actualQty: b.actualQty,
            reservedQty: b.reservedQty,
            availableQty,
            reorderLevel,
            reorderQty,
            suggestedQty: shouldReorder
              ? (reorderQty ?? reorderLevel ?? new Prisma.Decimal(0)).sub(availableQty).abs()
              : new Prisma.Decimal(0),
            shouldReorder,
          };
        })
        .filter((row) => row.shouldReorder);
    });
  }
}
