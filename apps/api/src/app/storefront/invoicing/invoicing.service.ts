import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listInvoices(tenantId: string, query: { status?: string; partyId?: string; search?: string; limit?: number; offset?: number }) {
    const { status, partyId, search, limit = 20, offset = 0 } = query;
    const where: Prisma.InvoiceWhereInput = { tenantId };
    if (status) where.status = status as any;
    if (partyId) where.partyId = partyId;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { partyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { items: true, payments: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((inv) => ({
        ...inv,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        discountAmount: Number(inv.discountAmount),
        grandTotal: Number(inv.grandTotal),
        amountPaid: Number(inv.amountPaid),
        amountDue: Number(inv.amountDue),
        items: inv.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          taxRate: Number(item.taxRate),
          taxAmount: Number(item.taxAmount),
          totalPrice: Number(item.totalPrice),
        })),
        payments: inv.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      })),
      pagination: { total, limit, offset, hasMore: offset + invoices.length < total },
    };
  }

  async getInvoice(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, payments: { orderBy: { paymentDate: 'desc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return {
      ...invoice,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      discountAmount: Number(invoice.discountAmount),
      grandTotal: Number(invoice.grandTotal),
      amountPaid: Number(invoice.amountPaid),
      amountDue: Number(invoice.amountDue),
      items: invoice.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
        taxAmount: Number(item.taxAmount),
        totalPrice: Number(item.totalPrice),
      })),
      payments: invoice.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }

  async createInvoice(tenantId: string, data: any) {
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    let nextNum = 1;
    if (lastInvoice?.invoiceNumber) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const invoiceNumber = `INV-${String(nextNum).padStart(5, '0')}`;

    const items = data.items || [];
    const subtotal = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) * Number(i.unitPrice) - Number(i.discount || 0)), 0);
    const taxAmount = items.reduce((sum: number, i: any) => {
      const lineTotal = Number(i.quantity) * Number(i.unitPrice) - Number(i.discount || 0);
      return sum + lineTotal * Number(i.taxRate || 0);
    }, 0);
    const grandTotal = subtotal + taxAmount - Number(data.discountAmount || 0);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        status: data.status || 'DRAFT',
        partyType: data.partyType || 'Customer',
        partyId: data.partyId,
        partyName: data.partyName,
        partyEmail: data.partyEmail,
        billingAddressLine1: data.billingAddressLine1,
        billingAddressLine2: data.billingAddressLine2,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingPostalCode: data.billingPostalCode,
        billingCountry: data.billingCountry,
        invoiceDate: new Date(data.invoiceDate || Date.now()),
        dueDate: new Date(data.dueDate || Date.now() + 30 * 86400000),
        orderId: data.orderId,
        currency: data.currency || 'USD',
        subtotal,
        taxAmount,
        discountAmount: Number(data.discountAmount || 0),
        grandTotal,
        amountDue: grandTotal,
        notes: data.notes,
        termsAndConditions: data.termsAndConditions,
        internalNotes: data.internalNotes,
        items: {
          create: items.map((item: any, idx: number) => {
            const lineTotal = Number(item.quantity) * Number(item.unitPrice) - Number(item.discount || 0);
            const itemTax = lineTotal * Number(item.taxRate || 0);
            return {
              tenantId,
              description: item.description,
              itemId: item.itemId,
              productListingId: item.productListingId,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount || 0),
              taxRate: Number(item.taxRate || 0),
              taxAmount: itemTax,
              totalPrice: lineTotal + itemTax,
              sortOrder: idx,
            };
          }),
        },
      },
      include: { items: true },
    });

    this.logger.log(`Invoice ${invoiceNumber} created for tenant ${tenantId}`);
    return invoice;
  }

  async updateInvoice(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft invoices can be edited');

    // Delete existing items and recreate
    if (data.items) {
      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    }

    const items = data.items || [];
    const subtotal = items.length > 0 ? items.reduce((sum: number, i: any) => sum + (Number(i.quantity) * Number(i.unitPrice) - Number(i.discount || 0)), 0) : Number(existing.subtotal);
    const taxAmount = items.length > 0 ? items.reduce((sum: number, i: any) => {
      const lineTotal = Number(i.quantity) * Number(i.unitPrice) - Number(i.discount || 0);
      return sum + lineTotal * Number(i.taxRate || 0);
    }, 0) : Number(existing.taxAmount);
    const discountAmount = data.discountAmount !== undefined ? Number(data.discountAmount) : Number(existing.discountAmount);
    const grandTotal = subtotal + taxAmount - discountAmount;

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        partyType: data.partyType ?? existing.partyType,
        partyId: data.partyId ?? existing.partyId,
        partyName: data.partyName ?? existing.partyName,
        partyEmail: data.partyEmail ?? existing.partyEmail,
        billingAddressLine1: data.billingAddressLine1 ?? existing.billingAddressLine1,
        billingAddressLine2: data.billingAddressLine2 ?? existing.billingAddressLine2,
        billingCity: data.billingCity ?? existing.billingCity,
        billingState: data.billingState ?? existing.billingState,
        billingPostalCode: data.billingPostalCode ?? existing.billingPostalCode,
        billingCountry: data.billingCountry ?? existing.billingCountry,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : existing.invoiceDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
        currency: data.currency ?? existing.currency,
        subtotal,
        taxAmount,
        discountAmount,
        grandTotal,
        amountDue: grandTotal - Number(existing.amountPaid),
        notes: data.notes ?? existing.notes,
        termsAndConditions: data.termsAndConditions ?? existing.termsAndConditions,
        internalNotes: data.internalNotes ?? existing.internalNotes,
        ...(items.length > 0
          ? {
              items: {
                create: items.map((item: any, idx: number) => {
                  const lineTotal = Number(item.quantity) * Number(item.unitPrice) - Number(item.discount || 0);
                  const itemTax = lineTotal * Number(item.taxRate || 0);
                  return {
                    tenantId,
                    description: item.description,
                    itemId: item.itemId,
                    productListingId: item.productListingId,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    discount: Number(item.discount || 0),
                    taxRate: Number(item.taxRate || 0),
                    taxAmount: itemTax,
                    totalPrice: lineTotal + itemTax,
                    sortOrder: idx,
                  };
                }),
              },
            }
          : {}),
      },
      include: { items: true, payments: true },
    });

    return invoice;
  }

  async sendInvoice(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  async recordPayment(tenantId: string, invoiceId: string, data: any) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paymentAmount = Number(data.amount);
    const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) + paymentAmount;
    const amountDue = Number(invoice.grandTotal) - totalPaid;
    const newStatus = amountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const [payment] = await this.prisma.$transaction([
      this.prisma.invoicePayment.create({
        data: {
          tenantId,
          invoiceId,
          amount: paymentAmount,
          paymentDate: new Date(data.paymentDate || Date.now()),
          method: data.method || 'bank_transfer',
          reference: data.reference,
          notes: data.notes,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: totalPaid,
          amountDue: amountDue > 0 ? amountDue : 0,
          status: newStatus,
          paidDate: newStatus === 'PAID' ? new Date() : null,
        },
      }),
    ]);

    return payment;
  }

  async deleteInvoice(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') throw new BadRequestException('Only draft invoices can be deleted');
    await this.prisma.invoice.delete({ where: { id } });
    return { success: true };
  }

  async getInvoiceStats(tenantId: string) {
    const [total, draft, sent, overdue, paid, totalRevenue, totalOutstanding] = await Promise.all([
      this.prisma.invoice.count({ where: { tenantId } }),
      this.prisma.invoice.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.invoice.count({ where: { tenantId, status: 'SENT' } }),
      this.prisma.invoice.count({ where: { tenantId, status: 'OVERDUE' } }),
      this.prisma.invoice.count({ where: { tenantId, status: 'PAID' } }),
      this.prisma.invoice.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { grandTotal: true } }),
      this.prisma.invoice.aggregate({ where: { tenantId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } }, _sum: { amountDue: true } }),
    ]);

    return {
      total,
      draft,
      sent,
      overdue,
      paid,
      totalRevenue: Number(totalRevenue._sum.grandTotal || 0),
      totalOutstanding: Number(totalOutstanding._sum.amountDue || 0),
    };
  }
}
