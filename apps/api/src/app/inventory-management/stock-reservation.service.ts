import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';

interface ReserveStockDto {
  itemCode: string;
  quantity: number;
  warehouseCode?: string; // Optional: if not specified, auto-select
  reference?: string; // Order number, reference, etc.
  notes?: string;
}

interface ReleaseStockDto {
  itemCode: string;
  quantity: number;
  warehouseCode?: string; // Optional: if not specified, release from all
  reference?: string;
}

@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserve stock for an order or allocation
   */
  async reserveStock(tenantId: string, dto: ReserveStockDto) {
    return this.prisma.$transaction(async (tx) => {
      // Find item
      const item = await tx.item.findFirst({
        where: { tenantId, code: dto.itemCode },
      });

      if (!item) {
        throw new NotFoundException(`Item not found: ${dto.itemCode}`);
      }

      // Acquire advisory lock for this item
      const itemKey = `${tenantId}:${item.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

      // Get balances
      const where: any = { tenantId, itemId: item.id };
      if (dto.warehouseCode) {
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId, code: dto.warehouseCode },
        });
        if (!warehouse) {
          throw new NotFoundException(`Warehouse not found: ${dto.warehouseCode}`);
        }
        where.warehouseId = warehouse.id;
      }

      const balances = await tx.warehouseItemBalance.findMany({
        where,
        include: { warehouse: true },
        orderBy: { createdAt: 'asc' }, // FIFO-style reservation
      });

      let remainingToReserve = dto.quantity;
      const reservations: Array<{
        warehouseCode: string;
        warehouseName: string;
        quantity: number;
      }> = [];

      for (const balance of balances) {
        if (remainingToReserve <= 0) break;

        const available = Number(balance.actualQty) - Number(balance.reservedQty);

        if (available > 0) {
          const take = Math.min(remainingToReserve, available);

          await tx.warehouseItemBalance.update({
            where: { id: balance.id },
            data: { reservedQty: { increment: take } },
          });

          reservations.push({
            warehouseCode: balance.warehouse.code,
            warehouseName: balance.warehouse.name,
            quantity: take,
          });

          remainingToReserve -= take;
        }
      }

      if (remainingToReserve > 0) {
        throw new BadRequestException(
          `Insufficient stock for ${dto.itemCode}. ` +
          `Requested: ${dto.quantity}, Available: ${dto.quantity - remainingToReserve}`,
        );
      }

      this.logger.log(
        `Reserved ${dto.quantity} units of ${dto.itemCode} ` +
        `${dto.reference ? `for ${dto.reference}` : ''}`,
      );

      return {
        success: true,
        itemCode: dto.itemCode,
        itemName: item.name,
        quantityReserved: dto.quantity,
        reservations,
        reference: dto.reference,
      };
    });
  }

  /**
   * Release reserved stock (e.g., when order is cancelled)
   */
  async releaseStock(tenantId: string, dto: ReleaseStockDto) {
    return this.prisma.$transaction(async (tx) => {
      // Find item
      const item = await tx.item.findFirst({
        where: { tenantId, code: dto.itemCode },
      });

      if (!item) {
        throw new NotFoundException(`Item not found: ${dto.itemCode}`);
      }

      // Acquire advisory lock
      const itemKey = `${tenantId}:${item.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

      // Get balances with reservations
      const where: any = {
        tenantId,
        itemId: item.id,
        reservedQty: { gt: 0 },
      };

      if (dto.warehouseCode) {
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId, code: dto.warehouseCode },
        });
        if (!warehouse) {
          throw new NotFoundException(`Warehouse not found: ${dto.warehouseCode}`);
        }
        where.warehouseId = warehouse.id;
      }

      const balances = await tx.warehouseItemBalance.findMany({
        where,
        include: { warehouse: true },
        orderBy: { createdAt: 'asc' },
      });

      let remainingToRelease = dto.quantity;
      const releases: Array<{
        warehouseCode: string;
        warehouseName: string;
        quantity: number;
      }> = [];

      for (const balance of balances) {
        if (remainingToRelease <= 0) break;

        const reserved = Number(balance.reservedQty);

        if (reserved > 0) {
          const take = Math.min(remainingToRelease, reserved);

          await tx.warehouseItemBalance.update({
            where: { id: balance.id },
            data: { reservedQty: { decrement: take } },
          });

          releases.push({
            warehouseCode: balance.warehouse.code,
            warehouseName: balance.warehouse.name,
            quantity: take,
          });

          remainingToRelease -= take;
        }
      }

      if (remainingToRelease > 0) {
        this.logger.warn(
          `Could only release ${dto.quantity - remainingToRelease} of ${dto.quantity} ` +
          `reserved units for ${dto.itemCode}`,
        );
      }

      this.logger.log(
        `Released ${dto.quantity - remainingToRelease} units of ${dto.itemCode} ` +
        `${dto.reference ? `for ${dto.reference}` : ''}`,
      );

      return {
        success: true,
        itemCode: dto.itemCode,
        itemName: item.name,
        quantityReleased: dto.quantity - remainingToRelease,
        releases,
        reference: dto.reference,
      };
    });
  }

  /**
   * Get reserved stock summary by item
   */
  async getReservedStock(tenantId: string, itemCode?: string) {
    const where: any = { tenantId, reservedQty: { gt: 0 } };

    if (itemCode) {
      const item = await this.prisma.item.findFirst({
        where: { tenantId, code: itemCode },
      });
      if (!item) {
        throw new NotFoundException(`Item not found: ${itemCode}`);
      }
      where.itemId = item.id;
    }

    const balances = await this.prisma.warehouseItemBalance.findMany({
      where,
      include: {
        item: {
          select: {
            code: true,
            name: true,
            stockUom: true,
          },
        },
        warehouse: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ item: { code: 'asc' } }, { warehouse: { code: 'asc' } }],
    });

    const summary = balances.map((balance) => ({
      itemCode: balance.item.code,
      itemName: balance.item.name,
      warehouseCode: balance.warehouse.code,
      warehouseName: balance.warehouse.name,
      actualQty: Number(balance.actualQty),
      reservedQty: Number(balance.reservedQty),
      availableQty: Number(balance.actualQty) - Number(balance.reservedQty),
      uom: balance.item.stockUom,
    }));

    // Calculate totals per item
    const itemTotals = summary.reduce((acc, item) => {
      if (!acc[item.itemCode]) {
        acc[item.itemCode] = {
          itemCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          totalActualQty: 0,
          totalReservedQty: 0,
          totalAvailableQty: 0,
          warehouses: [],
        };
      }
      acc[item.itemCode].totalActualQty += item.actualQty;
      acc[item.itemCode].totalReservedQty += item.reservedQty;
      acc[item.itemCode].totalAvailableQty += item.availableQty;
      acc[item.itemCode].warehouses.push({
        code: item.warehouseCode,
        name: item.warehouseName,
        actualQty: item.actualQty,
        reservedQty: item.reservedQty,
        availableQty: item.availableQty,
      });
      return acc;
    }, {} as any);

    return {
      summary: Object.values(itemTotals),
      totalItems: Object.keys(itemTotals).length,
    };
  }

  /**
   * Get reservation details for an order
   */
  async getOrderReservations(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          include: {
            product: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const reservations = await Promise.all(
      order.items.map(async (orderItem) => {
        if (!orderItem.product?.item) {
          return null;
        }

        const balances = await this.prisma.warehouseItemBalance.findMany({
          where: {
            tenantId,
            itemId: orderItem.product.item.id,
            reservedQty: { gt: 0 },
          },
          include: {
            warehouse: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        });

        return {
          orderItemId: orderItem.id,
          itemCode: orderItem.product.item.code,
          itemName: orderItem.product.item.name,
          quantityOrdered: orderItem.quantity,
          quantityFulfilled: orderItem.quantityFulfilled,
          reservations: balances.map((b) => ({
            warehouseCode: b.warehouse.code,
            warehouseName: b.warehouse.name,
            reservedQty: Number(b.reservedQty),
            actualQty: Number(b.actualQty),
          })),
        };
      }),
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      items: reservations.filter((r) => r !== null),
    };
  }
}
