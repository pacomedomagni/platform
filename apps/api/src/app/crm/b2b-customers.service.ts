import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

interface CreateCustomerDto {
  code: string;
  customerName: string;
  customerType?: string; // 'Company' | 'Individual'
  customerGroup?: string;
  territory?: string;
  taxId?: string;
  taxCategory?: string;
  defaultCurrency?: string;
  defaultPriceList?: string;
  defaultPaymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  receivableAccount?: string;
  primaryAddress?: string;
  primaryContact?: string;
  website?: string;
  notes?: string;
}

interface UpdateCustomerDto {
  customerName?: string;
  customerType?: string;
  customerGroup?: string;
  territory?: string;
  taxId?: string;
  taxCategory?: string;
  defaultCurrency?: string;
  defaultPriceList?: string;
  defaultPaymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  receivableAccount?: string;
  primaryAddress?: string;
  primaryContact?: string;
  website?: string;
  notes?: string;
  isActive?: boolean;
  isFrozen?: boolean;
}

@Injectable()
export class B2BCustomersService {
  private readonly logger = new Logger(B2BCustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all B2B customers with filtering
   */
  async listCustomers(
    tenantId: string,
    query: {
      search?: string;
      customerGroup?: string;
      territory?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const { search, customerGroup, territory, isActive, limit = 50, offset = 0 } = query;

    const where: Prisma.CustomerWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (customerGroup) {
      where.customerGroup = customerGroup;
    }

    if (territory) {
      where.territory = territory;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { customerName: 'asc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          code: true,
          customerName: true,
          customerType: true,
          customerGroup: true,
          territory: true,
          creditLimit: true,
          creditDays: true,
          defaultPaymentTerms: true,
          isActive: true,
          isFrozen: true,
          createdAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map((c) => ({
        ...c,
        creditLimit: Number(c.creditLimit),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + customers.length < total,
      },
    };
  }

  /**
   * Get customer details
   */
  async getCustomer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        storeCustomers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // LOGIC-5: Calculate credit usage — Order.customerId → StoreCustomer.id
    // Query orders where customerId is one of this B2B customer's StoreCustomer IDs
    const storeCustomerIds = customer.storeCustomers.map((sc) => sc.id);
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        customerId: { in: storeCustomerIds },
        paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
      },
      select: { grandTotal: true },
    });

    const creditUsed = orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);
    const creditLimit = Number(customer.creditLimit);
    const availableCredit = creditLimit > 0 ? creditLimit - creditUsed : 0;

    return {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      creditUsed,
      availableCredit,
      storeCustomers: customer.storeCustomers,
    };
  }

  /**
   * Create B2B customer
   */
  async createCustomer(tenantId: string, dto: CreateCustomerDto) {
    // Check if code already exists
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId, code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Customer code ${dto.code} already exists`);
    }

    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        code: dto.code,
        customerName: dto.customerName,
        customerType: dto.customerType || 'Company',
        customerGroup: dto.customerGroup,
        territory: dto.territory,
        taxId: dto.taxId,
        taxCategory: dto.taxCategory,
        defaultCurrency: dto.defaultCurrency,
        defaultPriceList: dto.defaultPriceList,
        defaultPaymentTerms: dto.defaultPaymentTerms,
        creditLimit: dto.creditLimit || 0,
        creditDays: dto.creditDays || 0,
        receivableAccount: dto.receivableAccount,
        primaryAddress: dto.primaryAddress,
        primaryContact: dto.primaryContact,
        website: dto.website,
        notes: dto.notes,
      },
    });

    this.logger.log(`Created B2B customer: ${customer.code} - ${customer.customerName}`);

    return {
      ...customer,
      creditLimit: Number(customer.creditLimit),
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(tenantId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        customerName: dto.customerName,
        customerType: dto.customerType,
        customerGroup: dto.customerGroup,
        territory: dto.territory,
        taxId: dto.taxId,
        taxCategory: dto.taxCategory,
        defaultCurrency: dto.defaultCurrency,
        defaultPriceList: dto.defaultPriceList,
        defaultPaymentTerms: dto.defaultPaymentTerms,
        creditLimit: dto.creditLimit,
        creditDays: dto.creditDays,
        receivableAccount: dto.receivableAccount,
        primaryAddress: dto.primaryAddress,
        primaryContact: dto.primaryContact,
        website: dto.website,
        notes: dto.notes,
        isActive: dto.isActive,
        isFrozen: dto.isFrozen,
      },
    });

    this.logger.log(`Updated B2B customer: ${updated.code}`);

    return {
      ...updated,
      creditLimit: Number(updated.creditLimit),
    };
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Deleted B2B customer: ${customer.code}`);

    return { success: true, message: 'Customer deleted' };
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats(tenantId: string) {
    const [totalCustomers, activeCustomers, companyCount, individualCount] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId, isActive: true } }),
      this.prisma.customer.count({ where: { tenantId, customerType: 'Company' } }),
      this.prisma.customer.count({ where: { tenantId, customerType: 'Individual' } }),
    ]);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers: totalCustomers - activeCustomers,
      companyCount,
      individualCount,
    };
  }

  /**
   * Get customer groups and territories (for filters)
   */
  async getCustomerFilters(tenantId: string) {
    // PERF-2: Use distinct queries instead of loading all customers
    const [groupRecords, territoryRecords] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId, customerGroup: { not: null } },
        select: { customerGroup: true },
        distinct: ['customerGroup'],
      }),
      this.prisma.customer.findMany({
        where: { tenantId, territory: { not: null } },
        select: { territory: true },
        distinct: ['territory'],
      }),
    ]);

    const groups = groupRecords.map((c) => c.customerGroup).filter(Boolean) as string[];
    const territories = territoryRecords.map((c) => c.territory).filter(Boolean) as string[];

    return {
      groups: groups.sort(),
      territories: territories.sort(),
    };
  }

  /**
   * Link a StoreCustomer to a B2B Customer
   */
  async linkStoreCustomer(tenantId: string, customerId: string, storeCustomerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('B2B Customer not found');
    }

    const storeCustomer = await this.prisma.storeCustomer.findFirst({
      where: { id: storeCustomerId, tenantId },
    });

    if (!storeCustomer) {
      throw new NotFoundException('Store customer not found');
    }

    await this.prisma.storeCustomer.update({
      where: { id: storeCustomerId },
      data: { customerId },
    });

    this.logger.log(
      `Linked store customer ${storeCustomer.email} to B2B customer ${customer.code}`,
    );

    return {
      success: true,
      message: 'Store customer linked to B2B account',
    };
  }
}
