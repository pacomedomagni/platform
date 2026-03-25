import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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
    @Req() req: Request,
    @Query() query: ListCouponsDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.listCoupons(tenantId, query);
  }

  /**
   * Get a single coupon by ID
   * GET /api/v1/store/admin/coupons/:id
   */
  @Get(':id')
  async getCoupon(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.getCoupon(tenantId, id);
  }

  /**
   * Create a new coupon
   * POST /api/v1/store/admin/coupons
   */
  @Post()
  async createCoupon(
    @Req() req: Request,
    @Body() dto: CreateCouponDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.createCoupon(tenantId, dto);
  }

  /**
   * Update an existing coupon
   * PUT /api/v1/store/admin/coupons/:id
   */
  @Put(':id')
  async updateCoupon(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.updateCoupon(tenantId, id, dto);
  }

  /**
   * Delete (or deactivate) a coupon
   * DELETE /api/v1/store/admin/coupons/:id
   */
  @Delete(':id')
  async deleteCoupon(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.couponService.deleteCoupon(tenantId, id);
  }
}
