import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { CreateZoneDto, UpdateZoneDto, CreateRateDto, CalculateShippingDto } from './shipping.dto';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Zone CRUD ──

  async createZone(tenantId: string, dto: CreateZoneDto) {
    return this.prisma.shippingZone.create({
      data: {
        tenantId,
        name: dto.name,
        countries: dto.countries || [],
        states: dto.states || [],
        zipCodes: dto.zipCodes || [],
        isDefault: dto.isDefault ?? false,
      },
      include: { rates: true },
    });
  }

  async listZones(tenantId: string) {
    return this.prisma.shippingZone.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        rates: {
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async updateZone(tenantId: string, zoneId: string, dto: UpdateZoneDto) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, tenantId },
    });
    if (!zone) throw new NotFoundException('Shipping zone not found');

    return this.prisma.shippingZone.update({
      where: { id: zoneId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.countries !== undefined && { countries: dto.countries }),
        ...(dto.states !== undefined && { states: dto.states }),
        ...(dto.zipCodes !== undefined && { zipCodes: dto.zipCodes }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
      include: { rates: true },
    });
  }

  async deleteZone(tenantId: string, zoneId: string) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, tenantId },
    });
    if (!zone) throw new NotFoundException('Shipping zone not found');

    await this.prisma.shippingZone.delete({ where: { id: zoneId } });
    return { deleted: true };
  }

  // ── Rate CRUD ──

  async createRate(tenantId: string, zoneId: string, dto: CreateRateDto) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, tenantId },
    });
    if (!zone) throw new NotFoundException('Shipping zone not found');

    return this.prisma.shippingRate.create({
      data: {
        tenantId,
        zoneId,
        name: dto.name,
        description: dto.description,
        type: dto.type || 'flat',
        price: dto.price,
        minOrderAmount: dto.minOrderAmount,
        maxOrderAmount: dto.maxOrderAmount,
        minWeight: dto.minWeight,
        maxWeight: dto.maxWeight,
        freeShippingThreshold: dto.freeShippingThreshold,
        estimatedDaysMin: dto.estimatedDaysMin,
        estimatedDaysMax: dto.estimatedDaysMax,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async listRates(tenantId: string, zoneId: string) {
    return this.prisma.shippingRate.findMany({
      where: { tenantId, zoneId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateRate(tenantId: string, rateId: string, dto: Partial<CreateRateDto>) {
    const rate = await this.prisma.shippingRate.findFirst({
      where: { id: rateId, tenantId },
    });
    if (!rate) throw new NotFoundException('Shipping rate not found');

    return this.prisma.shippingRate.update({
      where: { id: rateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.minOrderAmount !== undefined && { minOrderAmount: dto.minOrderAmount }),
        ...(dto.maxOrderAmount !== undefined && { maxOrderAmount: dto.maxOrderAmount }),
        ...(dto.minWeight !== undefined && { minWeight: dto.minWeight }),
        ...(dto.maxWeight !== undefined && { maxWeight: dto.maxWeight }),
        ...(dto.freeShippingThreshold !== undefined && { freeShippingThreshold: dto.freeShippingThreshold }),
        ...(dto.estimatedDaysMin !== undefined && { estimatedDaysMin: dto.estimatedDaysMin }),
        ...(dto.estimatedDaysMax !== undefined && { estimatedDaysMax: dto.estimatedDaysMax }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    });
  }

  async deleteRate(tenantId: string, rateId: string) {
    const rate = await this.prisma.shippingRate.findFirst({
      where: { id: rateId, tenantId },
    });
    if (!rate) throw new NotFoundException('Shipping rate not found');

    await this.prisma.shippingRate.delete({ where: { id: rateId } });
    return { deleted: true };
  }

  // ── Public: Calculate Shipping ──

  async calculateShipping(tenantId: string, dto: CalculateShippingDto) {
    // Find matching zones
    const zones = await this.prisma.shippingZone.findMany({
      where: { tenantId },
      include: { rates: { where: { isEnabled: true }, orderBy: { price: 'asc' } } },
    });

    // Match zones by address
    const matchingZones = zones.filter((zone) => {
      // Default zone always matches
      if (zone.isDefault) return true;

      const countryMatch =
        zone.countries.length === 0 || zone.countries.includes(dto.country);
      const stateMatch =
        zone.states.length === 0 || !dto.state || zone.states.includes(dto.state);
      const zipMatch =
        zone.zipCodes.length === 0 || !dto.zipCode || zone.zipCodes.includes(dto.zipCode);

      return countryMatch && stateMatch && zipMatch;
    });

    if (matchingZones.length === 0) {
      // Fallback to tenant's default shipping rate
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { defaultShippingRate: true },
      });

      return {
        rates: [
          {
            name: 'Standard Shipping',
            price: tenant ? Number(tenant.defaultShippingRate) : 9.99,
            type: 'flat',
          },
        ],
      };
    }

    // Collect all rates from matching zones, apply conditions
    const applicableRates = matchingZones
      .flatMap((zone) => zone.rates)
      .filter((rate) => {
        // Check free shipping threshold
        if (rate.freeShippingThreshold && dto.cartTotal >= Number(rate.freeShippingThreshold)) {
          return true; // Free shipping applies
        }

        // Check order amount range
        if (rate.minOrderAmount && dto.cartTotal < Number(rate.minOrderAmount)) return false;
        if (rate.maxOrderAmount && dto.cartTotal > Number(rate.maxOrderAmount)) return false;

        // Check weight range
        if (dto.cartWeight !== undefined) {
          if (rate.minWeight && dto.cartWeight < Number(rate.minWeight)) return false;
          if (rate.maxWeight && dto.cartWeight > Number(rate.maxWeight)) return false;
        }

        return true;
      })
      .map((rate) => {
        const isFree =
          rate.freeShippingThreshold && dto.cartTotal >= Number(rate.freeShippingThreshold);

        return {
          id: rate.id,
          name: rate.name,
          description: rate.description,
          price: isFree ? 0 : Number(rate.price),
          type: rate.type,
          estimatedDaysMin: rate.estimatedDaysMin,
          estimatedDaysMax: rate.estimatedDaysMax,
        };
      })
      .sort((a, b) => a.price - b.price);

    // Deduplicate by name (take cheapest)
    const seen = new Set<string>();
    const deduplicated = applicableRates.filter((rate) => {
      if (seen.has(rate.name)) return false;
      seen.add(rate.name);
      return true;
    });

    return { rates: deduplicated };
  }
}
