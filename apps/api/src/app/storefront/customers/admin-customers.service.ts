import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { AuditLogService } from '../../operations/audit-log.service';

@Injectable()
export class AdminCustomersService {
  private readonly logger = new Logger(AdminCustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  private async writeAudit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    docName: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.auditLog) return;
    try {
      await this.auditLog.log({ tenantId, userId: actorId }, { action, docType: 'StoreCustomer', docName, meta });
    } catch (e) {
      this.logger.warn(`Customer audit write swallowed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * List all customers for a tenant with optional search and segment filtering.
   * Returns customers enriched with orderCount, totalSpent, and lastOrderDate.
   */
  async listCustomers(
    tenantId: string,
    query: { search?: string; segment?: string; page?: number; limit?: number }
  ) {
    const { search, segment } = query;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // M7: Apply segment filtering in the Prisma WHERE clause BEFORE pagination
    if (segment) {
      switch (segment) {
        case 'new':
          where.createdAt = { gt: thirtyDaysAgo };
          break;
        case 'high_value':
          where.orders = { some: {} };
          // We'll further filter after fetch since totalSpent is computed
          break;
        case 'vip':
          where.orders = { some: {} };
          break;
        case 'at_risk':
          where.orders = { some: { createdAt: { lt: ninetyDaysAgo } } };
          break;
      }
    }

    // Get total count for stats (unfiltered by segment)
    const baseWhere: any = { tenantId };
    if (search) {
      baseWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const totalCount = await this.prisma.storeCustomer.count({ where: baseWhere });

    // Fetch customers with aggregated order data
    // For segments that need computed fields (high_value, vip, at_risk),
    // we fetch more and filter, then paginate
    const needsPostFilter = segment && ['high_value', 'vip', 'at_risk'].includes(segment);
    const fetchLimit = needsPostFilter ? 1000 : limit;
    const fetchSkip = needsPostFilter ? 0 : skip;

    const customers = await this.prisma.storeCustomer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: fetchSkip,
      take: fetchLimit,
      include: {
        orders: {
          select: {
            grandTotal: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Map to response shape with computed fields
    let mapped = customers.map((c) => {
      const orderCount = c.orders.length;
      const totalSpent = c.orders.reduce(
        (sum, o) => sum + Number(o.grandTotal),
        0
      );
      const lastOrderDate =
        c.orders.length > 0 ? c.orders[0].createdAt.toISOString() : null;

      return {
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        emailVerified: c.emailVerified,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        orderCount,
        totalSpent,
        lastOrderDate,
      };
    });

    // M7: Post-filter for computed-field segments, then apply pagination
    if (needsPostFilter) {
      mapped = mapped.filter((c) => {
        switch (segment) {
          case 'high_value':
            return c.totalSpent > 500;
          case 'vip':
            return c.totalSpent > 1000 && c.orderCount >= 5;
          case 'at_risk':
            return (
              c.lastOrderDate !== null &&
              new Date(c.lastOrderDate) < ninetyDaysAgo
            );
          default:
            return true;
        }
      });
    }

    // Apply pagination for post-filtered results
    const filteredTotal = needsPostFilter ? mapped.length : totalCount;
    if (needsPostFilter) {
      mapped = mapped.slice(skip, skip + limit);
    }

    // Compute stats -- note: stats reflect the current filtered set (L17)
    const stats = {
      total: totalCount,
      new: 0,
      highValue: 0,
      atRisk: 0,
    };

    // For accurate stats, we need unfiltered data from this page
    // These are best-effort counts from the current fetch
    const allMapped = customers.map((c) => {
      const orderCount = c.orders.length;
      const totalSpent = c.orders.reduce(
        (sum, o) => sum + Number(o.grandTotal),
        0
      );
      const lastOrderDate =
        c.orders.length > 0 ? c.orders[0].createdAt.toISOString() : null;
      return { createdAt: c.createdAt.toISOString(), totalSpent, lastOrderDate, orderCount };
    });

    stats.new = allMapped.filter((c) => new Date(c.createdAt) > thirtyDaysAgo).length;
    stats.highValue = allMapped.filter((c) => c.totalSpent > 500).length;
    stats.atRisk = allMapped.filter(
      (c) => c.lastOrderDate !== null && new Date(c.lastOrderDate) < ninetyDaysAgo
    ).length;

    return {
      data: mapped,
      stats,
      pagination: {
        page,
        limit,
        total: needsPostFilter ? filteredTotal : totalCount,
        totalPages: Math.ceil((needsPostFilter ? filteredTotal : totalCount) / limit),
      },
    };
  }

  /**
   * Get a single customer by ID with addresses.
   */
  async getCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      emailVerified: customer.emailVerified,
      isActive: customer.isActive,
      adminNotes: customer.adminNotes,
      createdAt: customer.createdAt.toISOString(),
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        firstName: a.firstName,
        lastName: a.lastName,
        company: a.company,
        phone: a.phone,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2 || undefined,
        city: a.city,
        state: a.state || undefined,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })),
    };
  }

  /**
   * Get orders for a specific customer.
   */
  async getCustomerOrders(tenantId: string, customerId: string) {
    // Verify customer exists
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const orders = await this.prisma.order.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          select: { id: true },
        },
      },
    });

    return {
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        grandTotal: Number(o.grandTotal),
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Update customer notes (admin).
   * Note: Requires 'adminNotes' field on StoreCustomer model.
   * Until the schema migration is applied, notes are accepted but not persisted.
   */
  async updateCustomerNotes(
    tenantId: string,
    customerId: string,
    notes: string
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // M6: Persist admin notes now that 'adminNotes' field is on StoreCustomer schema
    await this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: { adminNotes: notes },
    });

    return { success: true, notes };
  }

  /**
   * Update a customer's basic info (admin).
   */
  async updateCustomer(
    tenantId: string,
    customerId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; isActive?: boolean; notes?: string }
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        // H2: When deactivating a customer, increment tokenVersion to revoke all existing JWT tokens
        ...(dto.isActive === false && { tokenVersion: { increment: 1 } }),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      emailVerified: updated.emailVerified,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Bulk set active/inactive on customers. One transactional updateMany call;
   * tenant scope enforced in WHERE so cross-tenant ids silently no-op.
   * On deactivation, also increments tokenVersion (revokes all JWTs).
   */
  async bulkSetActive(tenantId: string, ids: string[], isActive: boolean, actorId?: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: 0, failed: 0, ids: [] as string[] };
    }
    const targets = await this.prisma.storeCustomer.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true },
    });
    const validIds = targets.map((t) => t.id);

    const result = await this.prisma.storeCustomer.updateMany({
      where: { id: { in: validIds }, tenantId },
      data: {
        isActive,
        ...(isActive === false ? { tokenVersion: { increment: 1 } } : {}),
      },
    });

    if (result.count > 0) {
      await this.writeAudit(
        tenantId,
        actorId,
        isActive ? 'customers.bulk_activated' : 'customers.bulk_deactivated',
        'bulk',
        {
          requestedCount: ids.length,
          affectedCount: result.count,
          skippedCount: ids.length - result.count,
          ids: validIds,
        },
      );
    }

    return {
      ok: result.count,
      failed: ids.length - result.count,
      ids: validIds,
    };
  }
}
