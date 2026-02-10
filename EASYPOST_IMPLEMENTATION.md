# EasyPost Master Account - Complete Implementation Plan

## Overview
This document provides a complete implementation guide for integrating EasyPost shipping aggregator with NoSlag's master account model.

**Timeline:** 1-2 weeks
**Cost:** $0.05 per label + carrier rates
**Carriers:** USPS, UPS, FedEx, DHL, Canada Post, and 95+ others

---

## Phase 1: Database Schema Updates

### 1.1 Update Shipment Model

Add EasyPost-specific fields to track shipment in both systems:

```prisma
model Shipment {
  // ... existing fields ...

  // EasyPost Integration Fields
  easypostShipmentId String?  @unique  // EasyPost shipment ID
  easypostTrackerId  String?           // EasyPost tracker ID
  easypostRateId     String?           // Selected rate ID
  carrierAccount     String?           // Carrier account used

  // Cost Tracking
  carrierCost        Decimal?  @db.Decimal(18, 4)  // What EasyPost charges
  customerCost       Decimal?  @db.Decimal(18, 4)  // What customer pays
  platformProfit     Decimal?  @db.Decimal(18, 4)  // Your markup

  // Address Verification
  addressVerified    Boolean   @default(false)
  verificationResult Json?     // EasyPost verification details

  // Insurance
  insuranceAmount    Decimal?  @db.Decimal(18, 2)
  insuranceCost      Decimal?  @db.Decimal(18, 4)

  // ... existing fields ...
}
```

### 1.2 Add Shipping Cost Tracking Table (for analytics)

```prisma
model ShippingCost {
  id         String   @id @default(uuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  shipmentId String
  shipment   Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Cost breakdown
  carrierCost       Decimal @db.Decimal(18, 4)  // EasyPost charge
  customerPaid      Decimal @db.Decimal(18, 4)  // Customer payment
  profit            Decimal @db.Decimal(18, 4)  // Your revenue
  markupPercent     Decimal @db.Decimal(5, 2)

  carrier           String
  service           String  // "USPS Priority", "UPS Ground", etc.

  // API tracking
  apiCost           Decimal @default(0.05) @db.Decimal(10, 4)  // EasyPost API fee

  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([orderId])
  @@map("shipping_costs")
}
```

### 1.3 Add Platform Settings Table

```prisma
model PlatformSetting {
  id    String @id @default(uuid())
  key   String @unique
  value String

  description String?
  updatedAt   DateTime @updatedAt

  @@map("platform_settings")
}

// Seed with:
// key: "shipping_markup_percent", value: "5.0"
// key: "easypost_webhook_secret", value: "whsec_..."
```

---

## Phase 2: Install Dependencies

```bash
cd apps/api
npm install @easypost/api
npm install -D @types/node
```

---

## Phase 3: Environment Variables

Add to `.env`:

```bash
# EasyPost Configuration
EASYPOST_API_KEY=EZAK_your_production_key_here
EASYPOST_TEST_KEY=EZTK_your_test_key_here
EASYPOST_MODE=test  # Switch to "production" when ready

# Shipping Settings
SHIPPING_MARKUP_PERCENT=5.0
ENABLE_ADDRESS_VERIFICATION=true
ENABLE_INSURANCE=true

# Webhook
EASYPOST_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

## Phase 4: Create EasyPost Service

### File: `apps/api/src/app/storefront/shipping/easypost.service.ts`

```typescript
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
  estimatedDays: number;
  rateId: string;
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
    const apiKey = mode === 'production'
      ? this.config.get('EASYPOST_API_KEY')
      : this.config.get('EASYPOST_TEST_KEY');

    if (!apiKey) {
      throw new Error('EasyPost API key not configured');
    }

    this.client = new EasyPostClient(apiKey);
    this.markupPercent = parseFloat(
      this.config.get('SHIPPING_MARKUP_PERCENT', '5.0')
    );

    this.logger.log(`EasyPost initialized in ${mode} mode`);
  }

  /**
   * Verify address validity
   */
  async verifyAddress(address: AddressDto) {
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

      // Store shipment ID temporarily for later purchase
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          metadata: {
            easypostShipmentId: shipment.id,
          },
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
        shipment = await this.client.Shipment.insure(shipment.id, insuranceAmount.toString());
      }

      // Buy the label with selected rate
      const boughtShipment = await this.client.Shipment.buy(shipment.id, rateId);

      // Calculate costs
      const carrierCost = parseFloat(boughtShipment.selected_rate.rate);
      const apiCost = 0.05;
      const totalCost = carrierCost + apiCost;
      const customerCost = this.applyMarkup(carrierCost);
      const profit = customerCost - totalCost;

      // Create or update shipment record
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
          },
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
  async createReturnLabel(
    tenantId: string,
    originalShipmentId: string,
  ) {
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
        originalShipment.easypostShipmentId
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
          rawData: latestEvent,
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
    const totalCost = costs.reduce((sum, c) => sum + Number(c.carrierCost) + Number(c.apiCost), 0);
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
```

---

## Phase 5: Update Shipping Controller

### File: `apps/api/src/app/storefront/shipping/shipping.controller.ts`

```typescript
import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { EasyPostService } from './easypost.service';
import { StoreAdminGuard } from '@platform/auth';
import { Tenant } from '../../../common/decorators/tenant.decorator';

@Controller('store/shipping')
export class ShippingController {
  constructor(private easyPostService: EasyPostService) {}

  /**
   * Verify shipping address
   */
  @Post('verify-address')
  async verifyAddress(@Body() address: any) {
    return this.easyPostService.verifyAddress(address);
  }

  /**
   * Get shipping rates for checkout
   */
  @Post('rates')
  async getRates(
    @Tenant() tenantId: string,
    @Body() body: {
      orderId: string;
      fromAddress: any;
      toAddress: any;
      parcel: any;
    }
  ) {
    return this.easyPostService.getRates(
      tenantId,
      body.orderId,
      body.fromAddress,
      body.toAddress,
      body.parcel,
    );
  }

  /**
   * Purchase shipping label
   */
  @Post('labels')
  @UseGuards(StoreAdminGuard)
  async buyLabel(
    @Tenant() tenantId: string,
    @Body() body: {
      orderId: string;
      rateId: string;
      insuranceAmount?: number;
    }
  ) {
    return this.easyPostService.buyLabel(
      tenantId,
      body.orderId,
      body.rateId,
      body.insuranceAmount,
    );
  }

  /**
   * Get tracking information
   */
  @Get('tracking/:trackingCode')
  async getTracking(
    @Param('trackingCode') trackingCode: string,
    @Query('carrier') carrier?: string,
  ) {
    return this.easyPostService.getTracking(trackingCode, carrier);
  }

  /**
   * Create return label
   */
  @Post('returns/:shipmentId/label')
  @UseGuards(StoreAdminGuard)
  async createReturnLabel(
    @Tenant() tenantId: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.easyPostService.createReturnLabel(tenantId, shipmentId);
  }

  /**
   * Get shipping analytics (admin only)
   */
  @Get('admin/analytics')
  @UseGuards(StoreAdminGuard)
  async getAnalytics(
    @Tenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.easyPostService.getShippingAnalytics(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * EasyPost webhook receiver
   */
  @Post('webhooks/easypost')
  async handleWebhook(@Body() event: any) {
    return this.easyPostService.handleWebhook(event);
  }
}
```

---

## Phase 6: Update Storefront Module

### File: `apps/api/src/app/storefront/storefront.module.ts`

Add imports:

```typescript
import { EasyPostService } from './shipping/easypost.service';
import { ShippingController } from './shipping/shipping.controller';

@Module({
  // ... existing imports ...
  controllers: [
    // ... existing controllers ...
    ShippingController,
  ],
  providers: [
    // ... existing providers ...
    EasyPostService,
  ],
})
export class StorefrontModule {}
```

---

## Phase 7: Frontend Integration

### Update Checkout to Use Dynamic Rates

```typescript
// apps/web/src/app/storefront/checkout/page.tsx

const [shippingRates, setShippingRates] = useState([]);
const [selectedRate, setSelectedRate] = useState(null);

useEffect(() => {
  const fetchRates = async () => {
    const response = await fetch('/api/v1/store/shipping/rates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        orderId: cart.id,
        fromAddress: {
          name: 'Your Store',
          street1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          country: 'US',
        },
        toAddress: {
          name: customer.name,
          street1: shippingAddress.street1,
          street2: shippingAddress.street2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zip,
          country: shippingAddress.country,
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          weight: 16, // oz
        },
      }),
    });

    const rates = await response.json();
    setShippingRates(rates);
    if (rates.length > 0) {
      setSelectedRate(rates[0]); // Select cheapest by default
    }
  };

  if (shippingAddress) {
    fetchRates();
  }
}, [shippingAddress]);

// Display rates
<div className="shipping-options">
  {shippingRates.map((rate) => (
    <label key={rate.rateId} className="shipping-option">
      <input
        type="radio"
        name="shippingRate"
        value={rate.rateId}
        checked={selectedRate?.rateId === rate.rateId}
        onChange={() => setSelectedRate(rate)}
      />
      <div>
        <strong>{rate.carrier} - {rate.service}</strong>
        <span>${rate.rate.toFixed(2)}</span>
        {rate.estimatedDays > 0 && (
          <span className="text-sm text-gray-500">
            Estimated delivery: {rate.estimatedDays} days
          </span>
        )}
      </div>
    </label>
  ))}
</div>
```

---

## Phase 8: Testing Checklist

### 8.1 Unit Tests
- [ ] EasyPost service initialization
- [ ] Markup calculation
- [ ] Address verification
- [ ] Rate retrieval and sorting
- [ ] Label purchase
- [ ] Cost tracking

### 8.2 Integration Tests
- [ ] Full checkout flow with shipping
- [ ] Label generation
- [ ] Tracking updates via webhook
- [ ] Return label creation
- [ ] Analytics aggregation

### 8.3 Manual Testing
- [ ] Test mode labels (use test API key)
- [ ] All major carriers (USPS, UPS, FedEx)
- [ ] International shipments
- [ ] Address verification
- [ ] Insurance option
- [ ] Return label generation
- [ ] Webhook delivery

---

## Phase 9: Go Live Checklist

### 9.1 EasyPost Account Setup
1. Sign up at https://easypost.com/signup
2. Verify email and phone
3. Add payment method (credit card)
4. Get production API key
5. Configure webhook URL: `https://yourplatform.com/api/v1/store/shipping/webhooks/easypost`
6. Enable webhook events: `tracker.updated`, `batch.updated`

### 9.2 Production Configuration
- [ ] Set `EASYPOST_MODE=production`
- [ ] Add production `EASYPOST_API_KEY`
- [ ] Set `SHIPPING_MARKUP_PERCENT` (recommend 5-8%)
- [ ] Configure webhook secret
- [ ] Test with real addresses

### 9.3 Monitoring
- [ ] Set up Sentry alerts for EasyPost errors
- [ ] Monitor shipping costs daily
- [ ] Track profit margins per tenant
- [ ] Monitor webhook delivery success rate

---

## Cost Projections

### Monthly Costs (1000 shipments example)

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| API Calls | 1,000 | $0.05 | $50.00 |
| Carrier Costs | 1,000 | ~$8.50 avg | $8,500 |
| Address Verification | 1,000 | $0.004 | $4.00 |
| **Your Cost** | | | **$8,554** |
| **Customer Pays** (5% markup) | | | **$8,980** |
| **Your Profit** | | | **$426** |

**Profit Margin:** ~4.7% on shipping revenue

---

## Volume Discounts

EasyPost offers volume discounts:
- 10,000+ labels/month: Negotiate rates
- 50,000+ labels/month: Dedicated account manager
- 100,000+ labels/month: Custom carrier agreements

---

## Support & Resources

- **EasyPost Docs:** https://docs.easypost.com/
- **API Reference:** https://docs.easypost.com/api
- **Support:** support@easypost.com
- **Status Page:** https://status.easypost.com/

---

## Next Steps

1. **Week 1:**
   - Run database migration
   - Install @easypost/api package
   - Create EasyPost service
   - Set up test account
   - Test rate shopping

2. **Week 2:**
   - Integrate into checkout flow
   - Build admin label generation UI
   - Set up webhooks
   - Test with sample orders
   - Deploy to production

3. **Week 3+:**
   - Monitor costs and adjust markup
   - Gather tenant feedback
   - Add advanced features (batch shipping, multi-package)
   - Optimize carrier selection

---

**Ready to implement?** Start with Phase 1 (database migration) and work through each phase sequentially.
