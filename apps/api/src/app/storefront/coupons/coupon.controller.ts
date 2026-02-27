import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Headers,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { CouponService } from './coupon.service';
import { CreateCouponDto, UpdateCouponDto, ListCouponsDto } from './coupon.dto';

@Controller('store/admin/coupons')
@UseGuards(StoreAdminGuard)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /**
   * List coupons with pagination and search
   * GET /api/v1/store/admin/coupons
   */
  @Get()
  async listCoupons(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ListCouponsDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.listCoupons(tenantId, query);
  }

  /**
   * Get a single coupon by ID
   * GET /api/v1/store/admin/coupons/:id
   */
  @Get(':id')
  async getCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.getCoupon(tenantId, id);
  }

  /**
   * Create a new coupon
   * POST /api/v1/store/admin/coupons
   */
  @Post()
  async createCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateCouponDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.createCoupon(tenantId, dto);
  }

  /**
   * Update an existing coupon
   * PUT /api/v1/store/admin/coupons/:id
   */
  @Put(':id')
  async updateCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.updateCoupon(tenantId, id, dto);
  }

  /**
   * Delete (or deactivate) a coupon
   * DELETE /api/v1/store/admin/coupons/:id
   */
  @Delete(':id')
  async deleteCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.deleteCoupon(tenantId, id);
  }
}
