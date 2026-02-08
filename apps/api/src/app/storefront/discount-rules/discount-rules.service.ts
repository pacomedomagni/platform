import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, DiscountType } from '@prisma/client';

interface CartInput {
  subtotal: number;
  items: Array<{
    productId: string;
    categoryId?: string;
    quantity: number;
    price: number;
  }>;
  quantity: number;
}

interface ApplicableRule {
  id: string;
  name: string;
  type: DiscountType;
  discountValue: number;
  calculatedDiscount: number;
}

@Injectable()
export class DiscountRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List discount rules with pagination, filter by isActive, type.
   */
  async listDiscountRules(
    tenantId: string,
    query: {
      limit?: number;
      offset?: number;
      isActive?: boolean;
      type?: DiscountType;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const { limit = 20, offset = 0, isActive, type } = query;

    const where: Prisma.DiscountRuleWhereInput = { tenantId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (type) {
      where.type = type;
    }

    const [data, total] = await Promise.all([
      this.prisma.discountRule.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.discountRule.count({ where }),
    ]);

    return {
      data: data.map((rule) => this.mapRuleToResponse(rule)),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  /**
   * Get a single discount rule.
   */
  async getDiscountRule(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const rule = await this.prisma.discountRule.findFirst({
      where: { id, tenantId },
    });

    if (!rule) {
      throw new NotFoundException('Discount rule not found');
    }

    return this.mapRuleToResponse(rule);
  }

  /**
   * Create a discount rule with all DiscountType variants.
   */
  async createDiscountRule(
    tenantId: string,
    data: {
      name: string;
      type: DiscountType;
      isActive?: boolean;
      isAutomatic?: boolean;
      discountValue: number;
      maxDiscount?: number;
      minOrderAmount?: number;
      minItemQuantity?: number;
      buyQuantity?: number;
      getQuantity?: number;
      getDiscount?: number;
      spendThreshold?: number;
      appliesToAll?: boolean;
      applicableProducts?: string[];
      applicableCategories?: string[];
      usageLimit?: number;
      startsAt?: Date;
      expiresAt?: Date;
      priority?: number;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Validate type-specific fields
    this.validateDiscountData(data.type, data);

    // Check for name uniqueness
    const existing = await this.prisma.discountRule.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      throw new ConflictException('Discount rule with this name already exists');
    }

    const rule = await this.prisma.discountRule.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        isActive: data.isActive ?? true,
        isAutomatic: data.isAutomatic ?? true,
        discountValue: data.discountValue,
        maxDiscount: data.maxDiscount,
        minOrderAmount: data.minOrderAmount,
        minItemQuantity: data.minItemQuantity,
        buyQuantity: data.buyQuantity,
        getQuantity: data.getQuantity,
        getDiscount: data.getDiscount,
        spendThreshold: data.spendThreshold,
        appliesToAll: data.appliesToAll ?? true,
        applicableProducts: data.applicableProducts ?? [],
        applicableCategories: data.applicableCategories ?? [],
        usageLimit: data.usageLimit,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        priority: data.priority ?? 0,
      },
    });

    return this.mapRuleToResponse(rule);
  }

  /**
   * Update a discount rule.
   */
  async updateDiscountRule(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      type?: DiscountType;
      isActive?: boolean;
      isAutomatic?: boolean;
      discountValue?: number;
      maxDiscount?: number | null;
      minOrderAmount?: number | null;
      minItemQuantity?: number | null;
      buyQuantity?: number | null;
      getQuantity?: number | null;
      getDiscount?: number | null;
      spendThreshold?: number | null;
      appliesToAll?: boolean;
      applicableProducts?: string[];
      applicableCategories?: string[];
      usageLimit?: number | null;
      startsAt?: Date | null;
      expiresAt?: Date | null;
      priority?: number;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const existing = await this.prisma.discountRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Discount rule not found');
    }

    // Check name uniqueness if changing
    if (data.name && data.name !== existing.name) {
      const duplicate = await this.prisma.discountRule.findFirst({
        where: { tenantId, name: data.name, id: { not: id } },
      });

      if (duplicate) {
        throw new ConflictException('Discount rule with this name already exists');
      }
    }

    const rule = await this.prisma.discountRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isAutomatic !== undefined && { isAutomatic: data.isAutomatic }),
        ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
        ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
        ...(data.minOrderAmount !== undefined && { minOrderAmount: data.minOrderAmount }),
        ...(data.minItemQuantity !== undefined && { minItemQuantity: data.minItemQuantity }),
        ...(data.buyQuantity !== undefined && { buyQuantity: data.buyQuantity }),
        ...(data.getQuantity !== undefined && { getQuantity: data.getQuantity }),
        ...(data.getDiscount !== undefined && { getDiscount: data.getDiscount }),
        ...(data.spendThreshold !== undefined && { spendThreshold: data.spendThreshold }),
        ...(data.appliesToAll !== undefined && { appliesToAll: data.appliesToAll }),
        ...(data.applicableProducts !== undefined && { applicableProducts: data.applicableProducts }),
        ...(data.applicableCategories !== undefined && { applicableCategories: data.applicableCategories }),
        ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
        ...(data.priority !== undefined && { priority: data.priority }),
      },
    });

    return this.mapRuleToResponse(rule);
  }

  /**
   * Delete a discount rule if not in use.
   */
  async deleteDiscountRule(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const rule = await this.prisma.discountRule.findFirst({
      where: { id, tenantId },
    });

    if (!rule) {
      throw new NotFoundException('Discount rule not found');
    }

    if (rule.timesUsed > 0) {
      throw new ConflictException(
        'Cannot delete a discount rule that has been used. Deactivate it instead.',
      );
    }

    await this.prisma.discountRule.delete({ where: { id } });

    return { success: true, id };
  }

  /**
   * Evaluate discount rules against a cart.
   * Find and apply best matching auto-discount rules.
   * Returns { applicableRules, totalDiscount }.
   */
  async evaluateDiscountRules(tenantId: string, cart: CartInput) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const now = new Date();

    // Fetch all active, automatic rules
    const rules = await this.prisma.discountRule.findMany({
      where: {
        tenantId,
        isActive: true,
        isAutomatic: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    const applicableRules: ApplicableRule[] = [];
    let totalDiscount = 0;

    for (const rule of rules) {
      // Check usage limit
      if (rule.usageLimit !== null && rule.timesUsed >= rule.usageLimit) {
        continue;
      }

      // Check minimum order amount
      if (rule.minOrderAmount !== null && cart.subtotal < Number(rule.minOrderAmount)) {
        continue;
      }

      // Check minimum item quantity
      if (rule.minItemQuantity !== null && cart.quantity < rule.minItemQuantity) {
        continue;
      }

      // Check product/category applicability
      if (!rule.appliesToAll) {
        const hasApplicableProduct = cart.items.some(
          (item) =>
            rule.applicableProducts.includes(item.productId) ||
            (item.categoryId && rule.applicableCategories.includes(item.categoryId)),
        );
        if (!hasApplicableProduct) continue;
      }

      // Calculate discount based on type
      let calculatedDiscount = 0;

      switch (rule.type) {
        case 'PERCENTAGE_OFF': {
          calculatedDiscount = cart.subtotal * (Number(rule.discountValue) / 100);
          if (rule.maxDiscount !== null) {
            calculatedDiscount = Math.min(calculatedDiscount, Number(rule.maxDiscount));
          }
          break;
        }

        case 'FIXED_AMOUNT_OFF': {
          calculatedDiscount = Math.min(Number(rule.discountValue), cart.subtotal);
          break;
        }

        case 'BUY_X_GET_Y': {
          if (rule.buyQuantity && rule.getQuantity) {
            const qualifyingSets = Math.floor(cart.quantity / (rule.buyQuantity + rule.getQuantity));
            if (qualifyingSets > 0) {
              // Find the cheapest items to discount
              const sortedPrices = cart.items
                .flatMap((item) => Array(item.quantity).fill(item.price))
                .sort((a, b) => a - b);
              const freeItems = qualifyingSets * rule.getQuantity;
              const getDiscountPercent = rule.getDiscount !== null ? Number(rule.getDiscount) : 100;
              calculatedDiscount = sortedPrices
                .slice(0, freeItems)
                .reduce((sum, price) => sum + price * (getDiscountPercent / 100), 0);
            }
          }
          break;
        }

        case 'FREE_SHIPPING': {
          // Free shipping is handled separately; mark with a nominal discount
          calculatedDiscount = 0;
          break;
        }

        case 'SPEND_X_GET_Y_OFF': {
          if (
            rule.spendThreshold !== null &&
            cart.subtotal >= Number(rule.spendThreshold)
          ) {
            calculatedDiscount = Math.min(Number(rule.discountValue), cart.subtotal);
          }
          break;
        }
      }

      if (calculatedDiscount > 0 || rule.type === 'FREE_SHIPPING') {
        applicableRules.push({
          id: rule.id,
          name: rule.name,
          type: rule.type,
          discountValue: Number(rule.discountValue),
          calculatedDiscount: Math.round(calculatedDiscount * 100) / 100,
        });
        totalDiscount += calculatedDiscount;
      }
    }

    return {
      applicableRules,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private validateDiscountData(type: DiscountType, data: Record<string, unknown>) {
    switch (type) {
      case 'BUY_X_GET_Y':
        if (!data.buyQuantity || !data.getQuantity) {
          throw new BadRequestException(
            'BUY_X_GET_Y requires buyQuantity and getQuantity',
          );
        }
        break;
      case 'SPEND_X_GET_Y_OFF':
        if (!data.spendThreshold) {
          throw new BadRequestException(
            'SPEND_X_GET_Y_OFF requires spendThreshold',
          );
        }
        break;
    }
  }

  private mapRuleToResponse(rule: Record<string, unknown>) {
    return {
      id: rule.id,
      name: rule.name,
      type: rule.type,
      isActive: rule.isActive,
      isAutomatic: rule.isAutomatic,
      discountValue: Number(rule.discountValue),
      maxDiscount: rule.maxDiscount !== null ? Number(rule.maxDiscount) : null,
      minOrderAmount: rule.minOrderAmount !== null ? Number(rule.minOrderAmount) : null,
      minItemQuantity: rule.minItemQuantity,
      buyQuantity: rule.buyQuantity,
      getQuantity: rule.getQuantity,
      getDiscount: rule.getDiscount !== null && rule.getDiscount !== undefined
        ? Number(rule.getDiscount)
        : null,
      spendThreshold: rule.spendThreshold !== null && rule.spendThreshold !== undefined
        ? Number(rule.spendThreshold)
        : null,
      appliesToAll: rule.appliesToAll,
      applicableProducts: rule.applicableProducts,
      applicableCategories: rule.applicableCategories,
      usageLimit: rule.usageLimit,
      timesUsed: rule.timesUsed,
      startsAt: rule.startsAt,
      expiresAt: rule.expiresAt,
      priority: rule.priority,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
