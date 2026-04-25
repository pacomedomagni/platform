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
import { Tenant } from '../../tenant.middleware';

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
    @Tenant() tenantId: string,
    @Query() query: ListCouponsDto,
  ) {    return this.couponService.listCoupons(tenantId, query);
  }

  /**
   * Get a single coupon by ID
   * GET /api/v1/store/admin/coupons/:id
   */
  @Get(':id')
  async getCoupon(
    @Tenant() tenantId: string,
    @Param('id') id: string,
  ) {    return this.couponService.getCoupon(tenantId, id);
  }

  /**
   * Create a new coupon
   * POST /api/v1/store/admin/coupons
   */
  @Post()
  async createCoupon(
    @Tenant() tenantId: string,
    @Body() dto: CreateCouponDto,
  ) {    return this.couponService.createCoupon(tenantId, dto);
  }

  /**
   * Update an existing coupon
   * PUT /api/v1/store/admin/coupons/:id
   */
  @Put(':id')
  async updateCoupon(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {    return this.couponService.updateCoupon(tenantId, id, dto);
  }

  /**
   * Delete (or deactivate) a coupon
   * DELETE /api/v1/store/admin/coupons/:id
   */
  @Delete(':id')
  async deleteCoupon(
    @Tenant() tenantId: string,
    @Param('id') id: string,
  ) {    return this.couponService.deleteCoupon(tenantId, id);
  }
}
