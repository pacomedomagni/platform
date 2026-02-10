import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import EasyPostClient from '@easypost/api';
import { PrismaService } from '@platform/db';
import { ConfigService } from '@nestjs/config';

interface AddressDto {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

interface ParcelDto {
  length: number;
  width: number;
  height: number;
  weight: number;
}

interface RateOption {
  carrier: string;
  service: string;
  rate: number;
  carrierCost: number;
  estimatedDays: number;
  rateId: string;
  currency?: string;
}

@Injectable()
export class EasyPostService {
  private readonly logger = new Logger(EasyPostService.name);
  private client: EasyPostClient;
  private markupPercent: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const mode = this.config.get('EASYPOST_MODE', 'test');
    const apiKey =
      mode === 'production'
        ? this.config.get('EASYPOST_API_KEY')
        : this.config.get('EASYPOST_TEST_KEY');

    if (!apiKey) {
      this.logger.warn('EasyPost API key not configured - shipping features will be limited');
      // Don't throw error - allow app to start without EasyPost configured
      return;
    }

    this.client = new EasyPostClient(apiKey);
    this.markupPercent = parseFloat(this.config.get('SHIPPING_MARKUP_PERCENT', '5.0'));

    this.logger.log(`EasyPost initialized in ${mode} mode with ${this.markupPercent}% markup`);
  }

  /**
   * Check if EasyPost is configured
   */
  private ensureConfigured() {
    if (!this.client) {
      throw new BadRequestException(
        'Shipping service is not configured. Please contact support.',
      );
    }
  }

  /**
   * Verify address validity
   */
  async verifyAddress(address: AddressDto) {
    this.ensureConfigured();

    try {
      const verifiedAddress = await this.client.Address.createAndVerify({
        street1: address.street1,
        street2: address.street2,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        name: address.name,
      });

      return {
        verified: true,
        address: verifiedAddress,
        verifications: verifiedAddress.verifications,
      };
    } catch (error) {
      this.logger.warn('Address verification failed', error);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Get shipping rates for a shipment
   */
  async getRates(
    tenantId: string,
    orderId: string,
    fromAddress: AddressDto,
    toAddress: AddressDto,
    parcel: ParcelDto,
  ): Promise<RateOption[]> {
    this.ensureConfigured();

    try {
      // Create shipment for rate shopping
      const shipment = await this.client.Shipment.create({
        to_address: {
          name: toAddress.name,
          street1: toAddress.street1,
          street2: toAddress.street2,
          city: toAddress.city,
          state: toAddress.state,
          zip: toAddress.zip,
          country: toAddress.country,
          phone: toAddress.phone,
          email: toAddress.email,
        },
        from_address: {
          name: fromAddress.name,
          street1: fromAddress.street1,
          street2: fromAddress.street2,
          city: fromAddress.city,
          state: fromAddress.state,
          zip: fromAddress.zip,
          country: fromAddress.country,
          phone: fromAddress.phone,
        },
        parcel: {
          length: parcel.length,
          width: parcel.width,
          height: parcel.height,
          weight: parcel.weight,
        },
        reference: `tenant-${tenantId}-order-${orderId}`,
      });

      // Store shipment ID in order metadata for later purchase
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          metadata: {
            easypostShipmentId: shipment.id,
          } as any,
        },
      });

      // Map rates with markup
      const rates: RateOption[] = shipment.rates.map((rate) => ({
        carrier: rate.carrier,
        service: rate.service,
        rate: this.applyMarkup(parseFloat(rate.rate)),
        carrierCost: parseFloat(rate.rate),
        estimatedDays: rate.delivery_days || 0,
        rateId: rate.id,
        currency: rate.currency,
      }));

      // Sort by price
      return rates.sort((a, b) => a.rate - b.rate);
    } catch (error) {
      this.logger.error('Failed to get rates from EasyPost', error);
      throw new BadRequestException('Failed to calculate shipping rates');
    }
  }

  /**
   * Buy shipping label
   */
  async buyLabel(
    tenantId: string,
    orderId: string,
    rateId: string,
    insuranceAmount?: number,
  ) {
    this.ensureConfigured();

    try {
      // Get order to retrieve shipment ID
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { metadata: true },
      });

      const easypostShipmentId = (order.metadata as any)?.easypostShipmentId;
      if (!easypostShipmentId) {
        throw new BadRequestException('Shipment not found. Please get rates first.');
      }

      // Retrieve shipment
      let shipment = await this.client.Shipment.retrieve(easypostShipmentId);

      // Add insurance if requested
      if (insuranceAmount) {
        shipment = await this.client.Shipment.insure(
          shipment.id,
          insuranceAmount.toString(),
        );
      }

      // Buy the label with selected rate
      const boughtShipment = await this.client.Shipment.buy(shipment.id, rateId);

      // Calculate costs
      const carrierCost = parseFloat(boughtShipment.selected_rate.rate);
      const apiCost = 0.05;
      const totalCost = carrierCost + apiCost;
      const customerCost = this.applyMarkup(carrierCost);
      const profit = customerCost - totalCost;

      // Create shipment record
      const shipmentRecord = await this.prisma.shipment.create({
        data: {
          tenantId,
          orderId,
          easypostShipmentId: boughtShipment.id,
          easypostRateId: rateId,
          easypostTrackerId: boughtShipment.tracker?.id,

          carrierName: boughtShipment.selected_rate.carrier,
          trackingNumber: boughtShipment.tracking_code,
          trackingUrl: boughtShipment.tracker?.public_url,
          labelUrl: boughtShipment.postage_label.label_url,

          status: 'label_created',

          carrierCost,
          customerCost,
          platformProfit: profit,

          insuranceAmount,
          insuranceCost: insuranceAmount ? parseFloat(boughtShipment.insurance) : null,

          metadata: {
            service: boughtShipment.selected_rate.service,
            deliveryDays: boughtShipment.selected_rate.delivery_days,
            labelFormat: boughtShipment.postage_label.label_format,
          } as any,
        },
      });

      // Track shipping cost
      await this.prisma.shippingCost.create({
        data: {
          tenantId,
          shipmentId: shipmentRecord.id,
          orderId,
          carrierCost,
          customerPaid: customerCost,
          profit,
          markupPercent: this.markupPercent,
          carrier: boughtShipment.selected_rate.carrier,
          service: boughtShipment.selected_rate.service,
          apiCost,
        },
      });

      return {
        shipmentId: shipmentRecord.id,
        labelUrl: boughtShipment.postage_label.label_url,
        trackingCode: boughtShipment.tracking_code,
        trackingUrl: boughtShipment.tracker?.public_url,
        carrier: boughtShipment.selected_rate.carrier,
        service: boughtShipment.selected_rate.service,
        cost: customerCost,
      };
    } catch (error) {
      this.logger.error('Failed to buy label from EasyPost', error);
      throw new BadRequestException('Failed to generate shipping label');
    }
  }

  /**
   * Get tracking information
   */
  async getTracking(trackingCode: string, carrier?: string) {
    this.ensureConfigured();

    try {
      const tracker = carrier
        ? await this.client.Tracker.create({ tracking_code: trackingCode, carrier })
        : await this.client.Tracker.create({ tracking_code: trackingCode });

      return {
        status: tracker.status,
        statusDetail: tracker.status_detail,
        estimatedDelivery: tracker.est_delivery_date,
        weight: tracker.weight,
        carrier: tracker.carrier,
        publicUrl: tracker.public_url,
        trackingDetails: tracker.tracking_details,
      };
    } catch (error) {
      this.logger.error('Failed to get tracking from EasyPost', error);
      throw new BadRequestException('Failed to retrieve tracking information');
    }
  }

  /**
   * Create return label
   */
  async createReturnLabel(tenantId: string, originalShipmentId: string) {
    this.ensureConfigured();

    try {
      const originalShipment = await this.prisma.shipment.findUnique({
        where: { id: originalShipmentId },
        include: { order: true },
      });

      if (!originalShipment?.easypostShipmentId) {
        throw new BadRequestException('Original shipment not found');
      }

      // Retrieve original shipment from EasyPost
      const easypostShipment = await this.client.Shipment.retrieve(
        originalShipment.easypostShipmentId,
      );

      // Create return shipment (reverse to/from addresses)
      const returnShipment = await this.client.Shipment.create({
        to_address: easypostShipment.from_address,
        from_address: easypostShipment.to_address,
        parcel: easypostShipment.parcel,
        is_return: true,
        reference: `return-${originalShipmentId}`,
      });

      // Buy cheapest rate
      const boughtReturn = await this.client.Shipment.buy(
        returnShipment.id,
        returnShipment.lowestRate(),
      );

      return {
        labelUrl: boughtReturn.postage_label.label_url,
        trackingCode: boughtReturn.tracking_code,
        carrier: boughtReturn.selected_rate.carrier,
      };
    } catch (error) {
      this.logger.error('Failed to create return label', error);
      throw new BadRequestException('Failed to create return label');
    }
  }

  /**
   * Handle webhook events from EasyPost
   */
  async handleWebhook(event: any) {
    try {
      const { description, object } = event;

      if (description.includes('tracker.updated')) {
        await this.updateShipmentTracking(object);
      }

      this.logger.log(`Processed EasyPost webhook: ${description}`);
    } catch (error) {
      this.logger.error('Failed to process EasyPost webhook', error);
    }
  }

  /**
   * Update shipment tracking from webhook
   */
  private async updateShipmentTracking(tracker: any) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber: tracker.tracking_code },
    });

    if (!shipment) {
      this.logger.warn(`Shipment not found for tracking: ${tracker.tracking_code}`);
      return;
    }

    // Update status
    let status = shipment.status;
    if (tracker.status === 'delivered') {
      status = 'delivered';
    } else if (tracker.status === 'in_transit' || tracker.status === 'out_for_delivery') {
      status = 'in_transit';
    } else if (tracker.status === 'failure' || tracker.status === 'cancelled') {
      status = 'failed';
    }

    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        actualDelivery: tracker.status === 'delivered' ? new Date() : undefined,
        estimatedDelivery: tracker.est_delivery_date
          ? new Date(tracker.est_delivery_date)
          : undefined,
      },
    });

    // Create tracking event
    if (tracker.tracking_details && tracker.tracking_details.length > 0) {
      const latestEvent = tracker.tracking_details[0];

      await this.prisma.shipmentEvent.create({
        data: {
          tenantId: shipment.tenantId,
          shipmentId: shipment.id,
          status: latestEvent.status,
          description: latestEvent.message,
          location: latestEvent.tracking_location?.city,
          occurredAt: new Date(latestEvent.datetime),
          rawData: latestEvent as any,
        },
      });
    }
  }

  /**
   * Apply markup percentage to carrier cost
   */
  private applyMarkup(cost: number): number {
    return parseFloat((cost * (1 + this.markupPercent / 100)).toFixed(2));
  }

  /**
   * Get shipping analytics for a tenant
   */
  async getShippingAnalytics(tenantId: string, startDate: Date, endDate: Date) {
    const costs = await this.prisma.shippingCost.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalShipments = costs.length;
    const totalRevenue = costs.reduce((sum, c) => sum + Number(c.customerPaid), 0);
    const totalCost = costs.reduce(
      (sum, c) => sum + Number(c.carrierCost) + Number(c.apiCost),
      0,
    );
    const totalProfit = costs.reduce((sum, c) => sum + Number(c.profit), 0);

    // Group by carrier
    const byCarrier = costs.reduce((acc, cost) => {
      if (!acc[cost.carrier]) {
        acc[cost.carrier] = { count: 0, revenue: 0, cost: 0, profit: 0 };
      }
      acc[cost.carrier].count++;
      acc[cost.carrier].revenue += Number(cost.customerPaid);
      acc[cost.carrier].cost += Number(cost.carrierCost);
      acc[cost.carrier].profit += Number(cost.profit);
      return acc;
    }, {});

    return {
      totalShipments,
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      byCarrier,
    };
  }
}
