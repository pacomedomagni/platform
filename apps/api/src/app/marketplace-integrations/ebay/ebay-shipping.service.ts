import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';

/**
 * eBay Shipping Labels Service
 * Manages shipping quotes, shipment creation, label downloads, and
 * cancellations via the eBay Sell Logistics API.
 */
@Injectable()
export class EbayShippingService {
  private readonly logger = new Logger(EbayShippingService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private audit: MarketplaceAuditService
  ) {}

  /**
   * Get a shipping rate quote for an order.
   * Queries available shipping options and rates from eBay Logistics API.
   */
  async getShippingQuote(
    connectionId: string,
    params: { orderId: string; shippingOption?: string }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock shipping quote for order ${params.orderId} on connection ${connectionId}`
      );
      return this.getMockShippingQuote(params.orderId);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        orders: [{ orderId: params.orderId }],
      };

      if (params.shippingOption) {
        body.shippingServiceCode = params.shippingOption;
      }

      const response = await (client.sell as any).logistics.createShippingQuote(body);

      this.logger.log(
        `Fetched shipping quote for order ${params.orderId} on connection ${connectionId}`
      );

      return {
        shippingQuoteId: response?.shippingQuoteId || null,
        orderId: params.orderId,
        rates: (response?.rates || []).map((rate: any) => ({
          rateId: rate.rateId,
          shippingServiceCode: rate.shippingServiceCode,
          shippingServiceName: rate.shippingServiceName,
          shippingCost: rate.shippingCost,
          additionalOptions: rate.additionalOptions || [],
          pickupSlots: rate.pickupSlots || [],
          maxEstimatedDeliveryDate: rate.maxEstimatedDeliveryDate || null,
          minEstimatedDeliveryDate: rate.minEstimatedDeliveryDate || null,
        })),
        creationDate: response?.creationDate || new Date().toISOString(),
        expirationDate: response?.expirationDate || null,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get shipping quote for order ${params.orderId} on connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a shipment and purchase a shipping label.
   * Requires a valid shipping quote ID and rate ID from a previous quote request.
   */
  async createShipment(
    connectionId: string,
    params: { shippingQuoteId: string; rateId: string }
  ): Promise<any> {
    if (this.mockMode) {
      const mockShipmentId = `mock_shipment_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created shipment ${mockShipmentId} for quote ${params.shippingQuoteId} on connection ${connectionId}`
      );
      return {
        shipmentId: mockShipmentId,
        shippingQuoteId: params.shippingQuoteId,
        rateId: params.rateId,
        status: 'PURCHASED',
        trackingNumber: `MOCK${Date.now()}`,
        carrier: 'USPS',
        labelAvailable: true,
        purchaseDate: new Date().toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).logistics.createFromShippingQuote({
        shippingQuoteId: params.shippingQuoteId,
        rateId: params.rateId,
      });

      const shipmentId =
        response?.shipmentId ||
        response?.shipmentHref?.split('/').pop() ||
        `ebay_shipment_${Date.now()}`;

      this.logger.log(
        `Created shipment ${shipmentId} for quote ${params.shippingQuoteId} on connection ${connectionId}`
      );

      try {
        await this.audit.logShipmentAction(shipmentId, 'CREATE_SHIPMENT', {
          connectionId,
          shippingQuoteId: params.shippingQuoteId,
          rateId: params.rateId,
        });
      } catch {
        // Non-critical
      }

      return {
        shipmentId,
        shippingQuoteId: params.shippingQuoteId,
        rateId: params.rateId,
        status: response?.shipmentStatus || 'PURCHASED',
        trackingNumber: response?.shipmentTrackingNumber || null,
        carrier: response?.shippingCarrierCode || null,
        labelAvailable: true,
        purchaseDate: response?.creationDate || new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to create shipment for quote ${params.shippingQuoteId} on connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get shipment details by shipment ID.
   */
  async getShipment(connectionId: string, shipmentId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched shipment ${shipmentId} for connection ${connectionId}`
      );
      return {
        shipmentId,
        status: 'PURCHASED',
        trackingNumber: `MOCK${shipmentId}`,
        carrier: 'USPS',
        shippingCost: { value: '7.50', currency: 'USD' },
        labelAvailable: true,
        purchaseDate: new Date(Date.now() - 3600000).toISOString(),
        shipByDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).logistics.getShipment(shipmentId);

      this.logger.log(
        `Fetched shipment ${shipmentId} for connection ${connectionId}`
      );

      return {
        shipmentId: response?.shipmentId || shipmentId,
        status: response?.shipmentStatus || 'UNKNOWN',
        trackingNumber: response?.shipmentTrackingNumber || null,
        carrier: response?.shippingCarrierCode || null,
        shippingCost: response?.shippingCost || null,
        labelAvailable: response?.labelAvailable ?? false,
        purchaseDate: response?.creationDate || null,
        shipByDate: response?.shipByDate || null,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch shipment ${shipmentId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Download the shipping label PDF for a shipment.
   * Returns the label as a base64-encoded string.
   */
  async downloadLabel(connectionId: string, shipmentId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Downloaded label for shipment ${shipmentId} for connection ${connectionId}`
      );
      // Return a minimal mock PDF placeholder (base64)
      return {
        shipmentId,
        content: Buffer.from('%PDF-1.4 mock-label-content').toString('base64'),
        contentType: 'application/pdf',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).logistics.downloadLabelFile(shipmentId);

      this.logger.log(
        `Downloaded label for shipment ${shipmentId} for connection ${connectionId}`
      );

      // Normalize the response to base64
      const content =
        response instanceof Buffer
          ? response.toString('base64')
          : typeof response === 'string'
            ? Buffer.from(response).toString('base64')
            : response?.data
              ? Buffer.from(response.data).toString('base64')
              : null;

      return {
        shipmentId,
        content,
        contentType: 'application/pdf',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to download label for shipment ${shipmentId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Cancel/void a shipment on eBay.
   */
  async cancelShipment(connectionId: string, shipmentId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Cancelled shipment ${shipmentId} for connection ${connectionId}`
      );
      return {
        shipmentId,
        status: 'VOIDED',
        message: '[MOCK] Shipment cancelled successfully',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).logistics.cancelShipment(shipmentId);

      this.logger.log(
        `Cancelled shipment ${shipmentId} for connection ${connectionId}`
      );

      try {
        await this.audit.logShipmentAction(shipmentId, 'CANCEL_SHIPMENT', {
          connectionId,
        });
      } catch {
        // Non-critical
      }

      return {
        shipmentId,
        status: 'VOIDED',
        message: 'Shipment cancelled successfully',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to cancel shipment ${shipmentId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mock data generators
  // ---------------------------------------------------------------------------

  private getMockShippingQuote(orderId: string): any {
    return {
      shippingQuoteId: `mock_quote_${Date.now()}`,
      orderId,
      rates: [
        {
          rateId: 'mock_rate_001',
          shippingServiceCode: 'USPS_PRIORITY',
          shippingServiceName: 'USPS Priority Mail',
          shippingCost: { value: '7.50', currency: 'USD' },
          additionalOptions: [],
          pickupSlots: [],
          maxEstimatedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
          minEstimatedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        },
        {
          rateId: 'mock_rate_002',
          shippingServiceCode: 'USPS_GROUND_ADVANTAGE',
          shippingServiceName: 'USPS Ground Advantage',
          shippingCost: { value: '5.25', currency: 'USD' },
          additionalOptions: [],
          pickupSlots: [],
          maxEstimatedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          minEstimatedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        },
        {
          rateId: 'mock_rate_003',
          shippingServiceCode: 'FEDEX_2DAY',
          shippingServiceName: 'FedEx 2Day',
          shippingCost: { value: '12.99', currency: 'USD' },
          additionalOptions: [],
          pickupSlots: [],
          maxEstimatedDeliveryDate: new Date(Date.now() + 2 * 86400000).toISOString(),
          minEstimatedDeliveryDate: new Date(Date.now() + 2 * 86400000).toISOString(),
        },
      ],
      creationDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 24 * 3600000).toISOString(),
    };
  }
}
