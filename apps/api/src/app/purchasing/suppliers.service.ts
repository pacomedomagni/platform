import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

interface CreateSupplierDto {
  code: string;
  supplierName: string;
  supplierType?: string; // 'Company' | 'Individual'
  supplierGroup?: string;
  country?: string;
  taxId?: string;
  taxCategory?: string;
  taxWithholdingCategory?: string;
  defaultCurrency?: string;
  defaultPriceList?: string;
  defaultPaymentTerms?: string;
  paymentDays?: number;
  payableAccount?: string;
  expenseAccount?: string;
  primaryAddress?: string;
  primaryContact?: string;
  website?: string;
  notes?: string;
}

interface UpdateSupplierDto {
  supplierName?: string;
  supplierType?: string;
  supplierGroup?: string;
  country?: string;
  taxId?: string;
  taxCategory?: string;
  taxWithholdingCategory?: string;
  defaultCurrency?: string;
  defaultPriceList?: string;
  defaultPaymentTerms?: string;
  paymentDays?: number;
  payableAccount?: string;
  expenseAccount?: string;
  primaryAddress?: string;
  primaryContact?: string;
  website?: string;
  notes?: string;
  isActive?: boolean;
  isFrozen?: boolean;
}

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all suppliers with filtering
   */
  async listSuppliers(
    tenantId: string,
    query: {
      search?: string;
      supplierGroup?: string;
      country?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const { search, supplierGroup, country, isActive, limit = 50, offset = 0 } = query;

    const where: Prisma.SupplierWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (supplierGroup) {
      where.supplierGroup = supplierGroup;
    }

    if (country) {
      where.country = country;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { supplierName: 'asc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          code: true,
          supplierName: true,
          supplierType: true,
          supplierGroup: true,
          country: true,
          defaultPaymentTerms: true,
          paymentDays: true,
          isActive: true,
          isFrozen: true,
          createdAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + suppliers.length < total,
      },
    };
  }

  /**
   * Get supplier details
   */
  async getSupplier(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  /**
   * Create supplier
   */
  async createSupplier(tenantId: string, dto: CreateSupplierDto) {
    // Check if code already exists
    const existing = await this.prisma.supplier.findFirst({
      where: { tenantId, code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Supplier code ${dto.code} already exists`);
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId,
        code: dto.code,
        supplierName: dto.supplierName,
        supplierType: dto.supplierType || 'Company',
        supplierGroup: dto.supplierGroup,
        country: dto.country,
        taxId: dto.taxId,
        taxCategory: dto.taxCategory,
        taxWithholdingCategory: dto.taxWithholdingCategory,
        defaultCurrency: dto.defaultCurrency,
        defaultPriceList: dto.defaultPriceList,
        defaultPaymentTerms: dto.defaultPaymentTerms,
        paymentDays: dto.paymentDays || 0,
        payableAccount: dto.payableAccount,
        expenseAccount: dto.expenseAccount,
        primaryAddress: dto.primaryAddress,
        primaryContact: dto.primaryContact,
        website: dto.website,
        notes: dto.notes,
      },
    });

    this.logger.log(`Created supplier: ${supplier.code} - ${supplier.supplierName}`);

    return supplier;
  }

  /**
   * Update supplier
   */
  async updateSupplier(tenantId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        supplierName: dto.supplierName,
        supplierType: dto.supplierType,
        supplierGroup: dto.supplierGroup,
        country: dto.country,
        taxId: dto.taxId,
        taxCategory: dto.taxCategory,
        taxWithholdingCategory: dto.taxWithholdingCategory,
        defaultCurrency: dto.defaultCurrency,
        defaultPriceList: dto.defaultPriceList,
        defaultPaymentTerms: dto.defaultPaymentTerms,
        paymentDays: dto.paymentDays,
        payableAccount: dto.payableAccount,
        expenseAccount: dto.expenseAccount,
        primaryAddress: dto.primaryAddress,
        primaryContact: dto.primaryContact,
        website: dto.website,
        notes: dto.notes,
        isActive: dto.isActive,
        isFrozen: dto.isFrozen,
      },
    });

    this.logger.log(`Updated supplier: ${updated.code}`);

    return updated;
  }

  /**
   * Delete supplier (soft delete)
   */
  async deleteSupplier(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    await this.prisma.supplier.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Deleted supplier: ${supplier.code}`);

    return { success: true, message: 'Supplier deleted' };
  }

  /**
   * Get supplier statistics
   */
  async getSupplierStats(tenantId: string) {
    const [totalSuppliers, activeSuppliers, companyCount, individualCount] = await Promise.all([
      this.prisma.supplier.count({ where: { tenantId } }),
      this.prisma.supplier.count({ where: { tenantId, isActive: true } }),
      this.prisma.supplier.count({ where: { tenantId, supplierType: 'Company' } }),
      this.prisma.supplier.count({ where: { tenantId, supplierType: 'Individual' } }),
    ]);

    return {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers: totalSuppliers - activeSuppliers,
      companyCount,
      individualCount,
    };
  }

  /**
   * Get supplier groups and countries (for filters)
   */
  async getSupplierFilters(tenantId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId },
      select: {
        supplierGroup: true,
        country: true,
      },
    });

    const groups = [...new Set(suppliers.map((s) => s.supplierGroup).filter(Boolean))];
    const countries = [...new Set(suppliers.map((s) => s.country).filter(Boolean))];

    return {
      groups: groups.sort(),
      countries: countries.sort(),
    };
  }
}
