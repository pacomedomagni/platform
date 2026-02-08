import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class TaxRulesService {
  private readonly logger = new Logger(TaxRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTaxRules(tenantId: string, query: { isActive?: string; region?: string; appliesTo?: string; limit?: number; offset?: number }) {
    const { isActive, region, appliesTo, limit = 50, offset = 0 } = query;
    const where: Prisma.TaxRuleWhereInput = { tenantId };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (region) where.region = region;
    if (appliesTo) where.appliesTo = appliesTo;

    const [taxRules, total] = await Promise.all([
      this.prisma.taxRule.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.taxRule.count({ where }),
    ]);

    return {
      data: taxRules.map((rule) => ({
        ...rule,
        rate: Number(rule.rate),
      })),
      pagination: { total, limit, offset, hasMore: offset + taxRules.length < total },
    };
  }

  async createTaxRule(tenantId: string, data: any) {
    const existing = await this.prisma.taxRule.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
    });
    if (existing) throw new BadRequestException('Tax rule with this name already exists');

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.taxRule.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const taxRule = await this.prisma.taxRule.create({
      data: {
        tenantId,
        name: data.name,
        rate: Number(data.rate),
        type: data.type || 'percentage',
        region: data.region,
        description: data.description,
        isInclusive: data.isInclusive || false,
        isDefault: data.isDefault || false,
        isActive: data.isActive ?? true,
        appliesTo: data.appliesTo || 'all',
      },
    });

    this.logger.log(`Tax rule "${data.name}" created for tenant ${tenantId}`);
    return { ...taxRule, rate: Number(taxRule.rate) };
  }

  async updateTaxRule(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.taxRule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Tax rule not found');

    // Check for name conflict if name is being changed
    if (data.name && data.name !== existing.name) {
      const conflict = await this.prisma.taxRule.findUnique({
        where: { tenantId_name: { tenantId, name: data.name } },
      });
      if (conflict) throw new BadRequestException('Tax rule with this name already exists');
    }

    // If setting as default, unset other defaults
    if (data.isDefault && !existing.isDefault) {
      await this.prisma.taxRule.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const taxRule = await this.prisma.taxRule.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        rate: data.rate !== undefined ? Number(data.rate) : existing.rate,
        type: data.type ?? existing.type,
        region: data.region ?? existing.region,
        description: data.description ?? existing.description,
        isInclusive: data.isInclusive ?? existing.isInclusive,
        isDefault: data.isDefault ?? existing.isDefault,
        isActive: data.isActive ?? existing.isActive,
        appliesTo: data.appliesTo ?? existing.appliesTo,
      },
    });

    return { ...taxRule, rate: Number(taxRule.rate) };
  }

  async deleteTaxRule(tenantId: string, id: string) {
    const taxRule = await this.prisma.taxRule.findFirst({ where: { id, tenantId } });
    if (!taxRule) throw new NotFoundException('Tax rule not found');
    if (taxRule.isDefault) throw new BadRequestException('Cannot delete the default tax rule');
    await this.prisma.taxRule.delete({ where: { id } });
    return { success: true };
  }

  async getDefaultTaxRule(tenantId: string) {
    const taxRule = await this.prisma.taxRule.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
    if (!taxRule) return null;
    return { ...taxRule, rate: Number(taxRule.rate) };
  }

  async calculateTax(tenantId: string, amount: number) {
    const defaultRule = await this.getDefaultTaxRule(tenantId);
    if (!defaultRule) {
      return {
        taxAmount: 0,
        taxRate: 0,
        taxRuleId: null,
        taxRuleName: null,
        isInclusive: false,
        subtotal: amount,
        total: amount,
      };
    }

    let taxAmount: number;
    let subtotal: number;

    if (defaultRule.type === 'fixed') {
      taxAmount = defaultRule.rate;
      subtotal = amount;
    } else if (defaultRule.isInclusive) {
      // Tax-inclusive: amount already includes tax
      subtotal = amount / (1 + defaultRule.rate);
      taxAmount = amount - subtotal;
    } else {
      // Tax-exclusive: add tax on top
      subtotal = amount;
      taxAmount = amount * defaultRule.rate;
    }

    return {
      taxAmount: Math.round(taxAmount * 100) / 100,
      taxRate: defaultRule.rate,
      taxRuleId: defaultRule.id,
      taxRuleName: defaultRule.name,
      isInclusive: defaultRule.isInclusive,
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }
}
