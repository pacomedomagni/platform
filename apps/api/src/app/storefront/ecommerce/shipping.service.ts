import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import {
  CreateCarrierDto,
  UpdateCarrierDto,
  CreateZoneDto,
  UpdateZoneDto,
  CreateRateDto,
  UpdateRateDto,
  CreateWeightTierDto,
  CalculateShippingDto,
  CreateShipmentDto,
  UpdateShipmentDto,
  AddTrackingEventDto,
} from './currency-shipping.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Carrier Management
  // ==========================================

  async listCarriers(tenantId: string) {
    return this.prisma.shippingCarrier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getCarrier(tenantId: string, id: string) {
    const carrier = await this.prisma.shippingCarrier.findFirst({
      where: { id, tenantId },
      include: {
        rates: {
          include: { zone: true },
        },
      },
    });

    if (!carrier) {
      throw new NotFoundException('Carrier not found');
    }

    // Mask sensitive data
    return {
      ...carrier,
      apiKey: carrier.apiKey ? '***' : null,
      apiSecret: carrier.apiSecret ? '***' : null,
    };
  }

  async createCarrier(tenantId: string, dto: CreateCarrierDto) {
    const code = dto.code.toLowerCase();

    const existing = await this.prisma.shippingCarrier.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });

    if (existing) {
      throw new BadRequestException(`Carrier with code ${code} already exists`);
    }

    return this.prisma.shippingCarrier.create({
      data: {
        tenantId,
        name: dto.name,
        code,
        type: dto.type || 'api',
        apiKey: dto.apiKey,
        apiSecret: dto.apiSecret,
        accountNumber: dto.accountNumber,
        testMode: dto.testMode ?? true,
        settings: (dto.settings || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateCarrier(tenantId: string, id: string, dto: UpdateCarrierDto) {
    const carrier = await this.prisma.shippingCarrier.findFirst({
      where: { id, tenantId },
    });

    if (!carrier) {
      throw new NotFoundException('Carrier not found');
    }

    const { settings, ...rest } = dto;
    return this.prisma.shippingCarrier.update({
      where: { id },
      data: {
        ...rest,
        ...(settings ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async deleteCarrier(tenantId: string, id: string) {
    const carrier = await this.prisma.shippingCarrier.findFirst({
      where: { id, tenantId },
    });

    if (!carrier) {
      throw new NotFoundException('Carrier not found');
    }

    await this.prisma.shippingCarrier.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Zone Management
  // ==========================================

  async listZones(tenantId: string) {
    return this.prisma.shippingZone.findMany({
      where: { tenantId },
      include: {
        rates: {
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createZone(tenantId: string, dto: CreateZoneDto) {
    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.shippingZone.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.shippingZone.create({
      data: {
        tenantId,
        name: dto.name,
        countries: dto.countries || [],
        states: dto.states || [],
        zipCodes: dto.zipCodes || [],
        isDefault: dto.isDefault || false,
      },
    });
  }

  async updateZone(tenantId: string, id: string, dto: UpdateZoneDto) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id, tenantId },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    if (dto.isDefault) {
      await this.prisma.shippingZone.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.shippingZone.update({
      where: { id },
      data: dto,
    });
  }

  async deleteZone(tenantId: string, id: string) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id, tenantId },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    await this.prisma.shippingZone.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Rate Management
  // ==========================================

  async listRates(tenantId: string, zoneId?: string) {
    return this.prisma.shippingRate.findMany({
      where: { tenantId, ...(zoneId ? { zoneId } : {}) },
      include: {
        zone: true,
        carrier: true,
        weightTiers: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
  }

  async createRate(tenantId: string, dto: CreateRateDto) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: dto.zoneId, tenantId },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    if (dto.carrierId) {
      const carrier = await this.prisma.shippingCarrier.findFirst({
        where: { id: dto.carrierId, tenantId },
      });
      if (!carrier) {
        throw new NotFoundException('Carrier not found');
      }
    }

    return this.prisma.shippingRate.create({
      data: {
        tenantId,
        zoneId: dto.zoneId,
        carrierId: dto.carrierId,
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
        carrierServiceCode: dto.carrierServiceCode,
        sortOrder: dto.sortOrder || 0,
      },
      include: {
        zone: true,
        carrier: true,
      },
    });
  }

  async updateRate(tenantId: string, id: string, dto: UpdateRateDto) {
    const rate = await this.prisma.shippingRate.findFirst({
      where: { id, tenantId },
    });

    if (!rate) {
      throw new NotFoundException('Rate not found');
    }

    return this.prisma.shippingRate.update({
      where: { id },
      data: dto,
      include: {
        zone: true,
        carrier: true,
      },
    });
  }

  async deleteRate(tenantId: string, id: string) {
    const rate = await this.prisma.shippingRate.findFirst({
      where: { id, tenantId },
    });

    if (!rate) {
      throw new NotFoundException('Rate not found');
    }

    await this.prisma.shippingRate.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Weight Tiers
  // ==========================================

  async addWeightTier(tenantId: string, dto: CreateWeightTierDto) {
    const rate = await this.prisma.shippingRate.findFirst({
      where: { id: dto.rateId, tenantId },
    });

    if (!rate) {
      throw new NotFoundException('Rate not found');
    }

    return this.prisma.shippingWeightTier.create({
      data: {
        tenantId,
        rateId: dto.rateId,
        minWeight: dto.minWeight,
        maxWeight: dto.maxWeight,
        price: dto.price,
        pricePerKg: dto.pricePerKg,
      },
    });
  }

  async deleteWeightTier(tenantId: string, id: string) {
    const tier = await this.prisma.shippingWeightTier.findFirst({
      where: { id, tenantId },
    });

    if (!tier) {
      throw new NotFoundException('Weight tier not found');
    }

    await this.prisma.shippingWeightTier.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Shipping Calculation
  // ==========================================

  async calculateShipping(tenantId: string, dto: CalculateShippingDto) {
    // Find matching zone
    const zone = await this.findMatchingZone(
      tenantId,
      dto.countryCode,
      dto.stateCode,
      dto.postalCode
    );

    if (!zone) {
      return { rates: [], message: 'No shipping available for this location' };
    }

    // Get rates for zone
    const rates = await this.prisma.shippingRate.findMany({
      where: {
        tenantId,
        zoneId: zone.id,
        isEnabled: true,
        OR: [
          { minOrderAmount: null },
          { minOrderAmount: { lte: dto.orderTotal } },
        ],
      },
      include: {
        carrier: true,
        weightTiers: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Calculate price for each rate
    const calculated = rates
      .map((rate) => {
        let price = Number(rate.price);

        // Check free shipping threshold
        if (rate.freeShippingThreshold && dto.orderTotal >= Number(rate.freeShippingThreshold)) {
          price = 0;
        } else if (rate.type === 'weight' && dto.weight) {
          // Weight-based pricing
          const tier = rate.weightTiers.find(
            (t) =>
              dto.weight! >= Number(t.minWeight) &&
              (!t.maxWeight || dto.weight! <= Number(t.maxWeight))
          );
          if (tier) {
            price = Number(tier.price);
            if (tier.pricePerKg) {
              const extraWeight = dto.weight - Number(tier.minWeight);
              price = price + (Number(tier.pricePerKg) * extraWeight);
            }
          }
        }

        // Check max weight
        if (rate.maxWeight && dto.weight && dto.weight > Number(rate.maxWeight)) {
          return null;
        }

        // Check max order amount
        if (rate.maxOrderAmount && dto.orderTotal > Number(rate.maxOrderAmount)) {
          return null;
        }

        return {
          id: rate.id,
          name: rate.name,
          description: rate.description,
          price: price,
          carrier: rate.carrier?.name,
          estimatedDays: rate.estimatedDaysMin && rate.estimatedDaysMax
            ? `${rate.estimatedDaysMin}-${rate.estimatedDaysMax} days`
            : rate.estimatedDaysMin
              ? `${rate.estimatedDaysMin}+ days`
              : null,
          isFree: price === 0,
        };
      })
      .filter(Boolean);

    return {
      zone: zone.name,
      rates: calculated,
    };
  }

  private async findMatchingZone(
    tenantId: string,
    countryCode: string,
    stateCode?: string,
    postalCode?: string
  ) {
    const zones = await this.prisma.shippingZone.findMany({
      where: { tenantId },
      orderBy: { isDefault: 'asc' }, // Non-default first to find specific matches
    });

    // Try to find specific match
    for (const zone of zones) {
      if (zone.isDefault) continue;

      // Check country
      const countryMatch = zone.countries.length === 0 ||
        zone.countries.includes(countryCode);
      if (!countryMatch) continue;

      // Check state
      const stateMatch = zone.states.length === 0 ||
        (stateCode && zone.states.includes(stateCode));
      if (zone.states.length > 0 && !stateMatch) continue;

      // Check postal code patterns
      if (zone.zipCodes.length > 0 && postalCode) {
        const postalMatch = zone.zipCodes.some((pattern) => {
          if (pattern.endsWith('*')) {
            return postalCode.startsWith(pattern.slice(0, -1));
          }
          return postalCode === pattern;
        });
        if (!postalMatch) continue;
      }

      return zone;
    }

    // Fall back to default zone
    return zones.find((z) => z.isDefault) || null;
  }

  // ==========================================
  // Shipment Management
  // ==========================================

  async listShipments(tenantId: string, options: { orderId?: string; page?: number; limit?: number }) {
    const { orderId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where = { tenantId, ...(orderId ? { orderId } : {}) };

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        include: {
          carrier: true,
          events: { orderBy: { occurredAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getShipment(tenantId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, tenantId },
      include: {
        carrier: true,
        order: {
          select: {
            orderNumber: true,
            shippingFirstName: true,
            shippingLastName: true,
            shippingAddressLine1: true,
            shippingCity: true,
            shippingState: true,
            shippingPostalCode: true,
            shippingCountry: true,
          },
        },
        events: { orderBy: { occurredAt: 'desc' } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async createShipment(tenantId: string, dto: CreateShipmentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.shipment.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        carrierId: dto.carrierId,
        carrierName: dto.carrierName,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
        weight: dto.weight,
        dimensions: dto.dimensions,
        status: 'pending',
      },
      include: {
        carrier: true,
      },
    });
  }

  async updateShipment(tenantId: string, id: string, dto: UpdateShipmentDto) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, tenantId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return this.prisma.shipment.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.status === 'in_transit' && !shipment.shippedAt
          ? { shippedAt: new Date() }
          : {}),
        ...(dto.status === 'delivered' && !shipment.actualDelivery
          ? { actualDelivery: new Date() }
          : {}),
      },
      include: {
        carrier: true,
        events: { orderBy: { occurredAt: 'desc' }, take: 5 },
      },
    });
  }

  async addTrackingEvent(tenantId: string, shipmentId: string, dto: AddTrackingEventDto) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, tenantId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Create event
    const event = await this.prisma.shipmentEvent.create({
      data: {
        tenantId,
        shipmentId,
        status: dto.status,
        description: dto.description,
        location: dto.location,
        occurredAt: dto.occurredAt,
        rawData: (dto.rawData || null) as Prisma.InputJsonValue | null,
      },
    });

    // Update shipment status
    const statusUpdates: Record<string, object> = {
      delivered: { status: 'delivered', actualDelivery: dto.occurredAt },
      in_transit: { status: 'in_transit', shippedAt: shipment.shippedAt || dto.occurredAt },
      out_for_delivery: { status: 'in_transit' },
      exception: { status: 'failed' },
    };

    const statusUpdate = statusUpdates[dto.status.toLowerCase()];
    if (statusUpdate) {
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: statusUpdate,
      });
    }

    return event;
  }

  async markAsShipped(tenantId: string, shipmentId: string, trackingNumber?: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, tenantId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'in_transit',
        trackingNumber: trackingNumber || shipment.trackingNumber,
        shippedAt: new Date(),
      },
      include: {
        carrier: true,
      },
    });
  }

  async markAsDelivered(tenantId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, tenantId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'delivered',
        actualDelivery: new Date(),
      },
    });
  }
}
