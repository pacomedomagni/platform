import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { DiscountRulesService } from './discount-rules.service';
import { DiscountType } from '@prisma/client';

@Controller('store/admin/discount-rules')
@UseGuards(StoreAdminGuard)
export class DiscountRulesController {
  constructor(private readonly discountRulesService: DiscountRulesService) {}

  /**
   * List discount rules
   * GET /api/v1/store/admin/discount-rules
   */
  @Get()
  async listRules(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('isActive') isActive?: string,
    @Query('type') type?: DiscountType,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.discountRulesService.listDiscountRules(tenantId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      type,
    });
  }

  /**
   * Get a single discount rule
   * GET /api/v1/store/admin/discount-rules/:id
   */
  @Get(':id')
  async getRule(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.discountRulesService.getDiscountRule(tenantId, id);
  }

  /**
   * Create a discount rule
   * POST /api/v1/store/admin/discount-rules
   */
  @Post()
  async createRule(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
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
    return this.discountRulesService.createDiscountRule(tenantId, body);
  }

  /**
   * Update a discount rule
   * PUT /api/v1/store/admin/discount-rules/:id
   */
  @Put(':id')
  async updateRule(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
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
    return this.discountRulesService.updateDiscountRule(tenantId, id, body);
  }

  /**
   * Delete a discount rule
   * DELETE /api/v1/store/admin/discount-rules/:id
   */
  @Delete(':id')
  async deleteRule(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.discountRulesService.deleteDiscountRule(tenantId, id);
  }

  /**
   * Evaluate/test discount rules against a sample cart
   * POST /api/v1/store/admin/discount-rules/evaluate
   */
  @Post('evaluate')
  async evaluateRules(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      subtotal: number;
      items: Array<{
        productId: string;
        categoryId?: string;
        quantity: number;
        price: number;
      }>;
      quantity: number;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.discountRulesService.evaluateDiscountRules(tenantId, body);
  }
}
