import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { CreateCouponDto, UpdateCouponDto, ListCouponsDto } from './coupon.dto';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List coupons with pagination and optional search/filter
   */
  async listCoupons(tenantId: string, query: ListCouponsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = { tenantId };

    // Filter by active status
    if (query.isActive === 'true') {
      where.isActive = true;
    } else if (query.isActive === 'false') {
      where.isActive = false;
    }

    // Search by code (case-insensitive)
    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { usages: true },
          },
        },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      data: coupons.map((c) => this.mapCoupon(c)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single coupon by ID with usage stats
   */
  async getCoupon(tenantId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.mapCoupon(coupon);
  }

  /**
   * Create a new coupon with validation
   */
  async createCoupon(tenantId: string, dto: CreateCouponDto) {
    // Normalize code to uppercase
    const code = dto.code.trim().toUpperCase();

    // Check uniqueness per tenant
    const existing = await this.prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });

    if (existing) {
      throw new ConflictException(
        `A coupon with code "${code}" already exists`
      );
    }

    // L6: Check expiresAt is not in the past
    if (dto.expiresAt && new Date(dto.expiresAt) < new Date()) {
      throw new BadRequestException(
        'Expiry date must be in the future'
      );
    }

    // Validate date range
    if (dto.startsAt && dto.expiresAt) {
      if (new Date(dto.expiresAt) <= new Date(dto.startsAt)) {
        throw new BadRequestException(
          'Expiration date must be after start date'
        );
      }
    }

    // Validate percentage discount value
    if (dto.discountType === 'percentage' && dto.discountValue > 100) {
      throw new BadRequestException(
        'Percentage discount cannot exceed 100'
      );
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        tenantId,
        code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minimumOrderAmount: dto.minimumOrderAmount ?? null,
        maximumDiscount: dto.maximumDiscount ?? null,
        usageLimit: dto.usageLimit ?? null,
        usageLimitPerCustomer: dto.usageLimitPerCustomer ?? 1,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    return this.mapCoupon(coupon);
  }

  /**
   * Update an existing coupon
   */
  async updateCoupon(tenantId: string, id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    // If code is being changed, check uniqueness
    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      if (code !== existing.code) {
        const duplicate = await this.prisma.coupon.findUnique({
          where: { tenantId_code: { tenantId, code } },
        });
        if (duplicate) {
          throw new ConflictException(
            `A coupon with code "${code}" already exists`
          );
        }
      }
    }

    // Resolve final dates for validation
    const finalStartsAt = dto.startsAt !== undefined
      ? (dto.startsAt ? new Date(dto.startsAt) : null)
      : existing.startsAt;
    const finalExpiresAt = dto.expiresAt !== undefined
      ? (dto.expiresAt ? new Date(dto.expiresAt) : null)
      : existing.expiresAt;

    if (finalStartsAt && finalExpiresAt && finalExpiresAt <= finalStartsAt) {
      throw new BadRequestException(
        'Expiration date must be after start date'
      );
    }

    // Validate percentage discount value
    const finalType = dto.discountType ?? existing.discountType;
    const finalValue = dto.discountValue ?? Number(existing.discountValue);
    if (finalType === 'percentage' && finalValue > 100) {
      throw new BadRequestException(
        'Percentage discount cannot exceed 100'
      );
    }

    const data: Prisma.CouponUpdateInput = {};

    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.minimumOrderAmount !== undefined)
      data.minimumOrderAmount = dto.minimumOrderAmount;
    if (dto.maximumDiscount !== undefined)
      data.maximumDiscount = dto.maximumDiscount;
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.usageLimitPerCustomer !== undefined)
      data.usageLimitPerCustomer = dto.usageLimitPerCustomer;
    if (dto.startsAt !== undefined)
      data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.expiresAt !== undefined)
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // M1: Use updateMany with tenantId scope for defense in depth, then fetch the updated record
    const updateResult = await this.prisma.coupon.updateMany({
      where: { id, tenantId },
      data: data as any,
    });

    if (updateResult.count === 0) {
      throw new NotFoundException('Coupon not found');
    }

    const coupon = await this.prisma.coupon.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.mapCoupon(coupon);
  }

  /**
   * Delete a coupon.
   * If the coupon has been used (timesUsed > 0), soft-delete by setting isActive=false.
   * Otherwise, hard-delete.
   */
  async deleteCoupon(tenantId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, tenantId },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (coupon.timesUsed > 0) {
      // Soft delete - deactivate to preserve order history references
      // Use updateMany with tenantId for defense in depth
      await this.prisma.coupon.updateMany({
        where: { id, tenantId },
        data: { isActive: false },
      });
      return { message: 'Coupon deactivated (has existing usage history)' };
    }

    // Use deleteMany with tenantId for defense in depth
    await this.prisma.coupon.deleteMany({ where: { id, tenantId } });
    return { message: 'Coupon deleted' };
  }

  // ============ INTERNAL HELPERS ============

  private mapCoupon(
    coupon: Prisma.CouponGetPayload<{
      include: { _count: { select: { usages: true } } };
    }>
  ) {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minimumOrderAmount: coupon.minimumOrderAmount
        ? Number(coupon.minimumOrderAmount)
        : null,
      maximumDiscount: coupon.maximumDiscount
        ? Number(coupon.maximumDiscount)
        : null,
      usageLimit: coupon.usageLimit,
      usageLimitPerCustomer: coupon.usageLimitPerCustomer,
      timesUsed: coupon.timesUsed,
      totalUsages: coupon._count.usages,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };
  }
}
