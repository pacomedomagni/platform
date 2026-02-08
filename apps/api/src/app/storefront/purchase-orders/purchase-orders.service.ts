import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPurchaseOrders(tenantId: string, query: { status?: string; supplierId?: string; search?: string; limit?: number; offset?: number }) {
    const { status, supplierId, search, limit = 20, offset = 0 } = query;
    const where: Prisma.PurchaseOrderWhereInput = { tenantId };
    if (status) where.status = status as any;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { items: true, _count: { select: { goodsReceipts: true } } },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: orders.map((po) => ({
        ...po,
        subtotal: Number(po.subtotal),
        taxAmount: Number(po.taxAmount),
        shippingCost: Number(po.shippingCost),
        grandTotal: Number(po.grandTotal),
        items: po.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          taxAmount: Number(item.taxAmount),
          totalPrice: Number(item.totalPrice),
          quantityReceived: Number(item.quantityReceived),
        })),
        goodsReceiptCount: po._count.goodsReceipts,
      })),
      pagination: { total, limit, offset, hasMore: offset + orders.length < total },
    };
  }

  async getPurchaseOrder(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        goodsReceipts: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return {
      ...po,
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      shippingCost: Number(po.shippingCost),
      grandTotal: Number(po.grandTotal),
      items: po.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        taxAmount: Number(item.taxAmount),
        totalPrice: Number(item.totalPrice),
        quantityReceived: Number(item.quantityReceived),
      })),
    };
  }

  async createPurchaseOrder(tenantId: string, data: any) {
    const items = data.items || [];
    const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
    const taxAmount = items.reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.unitPrice) * Number(i.taxRate || 0), 0);
    const grandTotal = subtotal + taxAmount + Number(data.shippingCost || 0);

    const po = await this.prisma.$transaction(async (tx) => {
      const lastPO = await tx.purchaseOrder.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { poNumber: true },
      });
      let nextNum = 1;
      if (lastPO?.poNumber) {
        const match = lastPO.poNumber.match(/PO-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const poNumber = `PO-${String(nextNum).padStart(5, '0')}`;

      return tx.purchaseOrder.create({
        data: {
          tenantId,
          poNumber,
          status: data.status || 'DRAFT',
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          supplierEmail: data.supplierEmail,
          deliveryWarehouseId: data.deliveryWarehouseId,
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
          currency: data.currency || 'USD',
          subtotal,
          taxAmount,
          shippingCost: Number(data.shippingCost || 0),
          grandTotal,
          orderDate: new Date(data.orderDate || Date.now()),
          notes: data.notes,
          internalNotes: data.internalNotes,
          items: {
            create: items.map((item: any, idx: number) => ({
              tenantId,
              itemId: item.itemId,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              taxRate: Number(item.taxRate || 0),
              taxAmount: Number(item.quantity) * Number(item.unitPrice) * Number(item.taxRate || 0),
              totalPrice: Number(item.quantity) * Number(item.unitPrice) * (1 + Number(item.taxRate || 0)),
              sortOrder: idx,
            })),
          },
        },
        include: { items: true },
      });
    });

    this.logger.log(`PO ${po.poNumber} created for tenant ${tenantId}`);
    return po;
  }

  async updatePurchaseOrder(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Purchase order not found');
    if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) throw new BadRequestException('Only draft/submitted POs can be edited');

    if (data.items) {
      await this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    const items = data.items || [];
    const subtotal = items.length > 0 ? items.reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.unitPrice), 0) : Number(existing.subtotal);
    const taxAmount = items.length > 0 ? items.reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.unitPrice) * Number(i.taxRate || 0), 0) : Number(existing.taxAmount);
    const shippingCost = data.shippingCost !== undefined ? Number(data.shippingCost) : Number(existing.shippingCost);
    const grandTotal = subtotal + taxAmount + shippingCost;

    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: data.status ?? existing.status,
        supplierId: data.supplierId ?? existing.supplierId,
        supplierName: data.supplierName ?? existing.supplierName,
        supplierEmail: data.supplierEmail ?? existing.supplierEmail,
        deliveryWarehouseId: data.deliveryWarehouseId ?? existing.deliveryWarehouseId,
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : existing.expectedDeliveryDate,
        subtotal,
        taxAmount,
        shippingCost,
        grandTotal,
        notes: data.notes ?? existing.notes,
        internalNotes: data.internalNotes ?? existing.internalNotes,
        ...(data.status === 'APPROVED' ? { approvedAt: new Date(), approvedBy: data.approvedBy } : {}),
        ...(items.length > 0
          ? {
              items: {
                create: items.map((item: any, idx: number) => ({
                  tenantId,
                  itemId: item.itemId,
                  description: item.description,
                  quantity: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                  taxRate: Number(item.taxRate || 0),
                  taxAmount: Number(item.quantity) * Number(item.unitPrice) * Number(item.taxRate || 0),
                  totalPrice: Number(item.quantity) * Number(item.unitPrice) * (1 + Number(item.taxRate || 0)),
                  sortOrder: idx,
                })),
              },
            }
          : {}),
      },
      include: { items: true },
    });

    return po;
  }

  async receiveGoods(tenantId: string, purchaseOrderId: string, data: any) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new BadRequestException('PO must be approved before receiving goods');
    }

    const receipt = await this.prisma.$transaction(async (tx) => {
      const lastReceipt = await tx.goodsReceipt.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { receiptNumber: true },
      });
      let nextNum = 1;
      if (lastReceipt?.receiptNumber) {
        const match = lastReceipt.receiptNumber.match(/GR-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const receiptNumber = `GR-${String(nextNum).padStart(5, '0')}`;

      const gr = await tx.goodsReceipt.create({
        data: {
          tenantId,
          receiptNumber,
          purchaseOrderId,
          warehouseId: data.warehouseId,
          receivedDate: new Date(data.receivedDate || Date.now()),
          receivedBy: data.receivedBy,
          notes: data.notes,
          items: {
            create: data.items.map((item: any) => ({
              tenantId,
              purchaseOrderItemId: item.purchaseOrderItemId,
              itemId: item.itemId,
              description: item.description,
              quantityReceived: Number(item.quantityReceived),
              unitPrice: Number(item.unitPrice),
              batchNo: item.batchNo,
              serialNos: item.serialNos || [],
            })),
          },
        },
        include: { items: true },
      });

      // Update PO item received quantities
      for (const item of data.items) {
        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: {
            quantityReceived: { increment: Number(item.quantityReceived) },
          },
        });
      }

      // Check if all items fully received
      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
      const allReceived = updatedItems.every((item) => Number(item.quantityReceived) >= Number(item.quantity));

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });

      return gr;
    });

    this.logger.log(`Goods receipt ${receipt.receiptNumber} created for PO ${po.poNumber}`);
    return receipt;
  }

  async deletePurchaseOrder(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') throw new BadRequestException('Only draft POs can be deleted');
    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { success: true };
  }

  async getPurchaseOrderStats(tenantId: string) {
    const [total, draft, approved, partiallyReceived, received, totalValue] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { tenantId } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'APPROVED' } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'PARTIALLY_RECEIVED' } }),
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'RECEIVED' } }),
      this.prisma.purchaseOrder.aggregate({ where: { tenantId }, _sum: { grandTotal: true } }),
    ]);

    return { total, draft, approved, partiallyReceived, received, totalValue: Number(totalValue._sum.grandTotal || 0) };
  }
}
