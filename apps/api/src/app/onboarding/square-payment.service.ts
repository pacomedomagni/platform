import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SquareOAuthService } from './square-oauth.service';

@Injectable()
export class SquarePaymentService {
  private readonly logger = new Logger(SquarePaymentService.name);
  private readonly apiBase: string;

  constructor(private readonly squareOAuth: SquareOAuthService) {
    this.apiBase =
      process.env['SQUARE_ENVIRONMENT'] === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
  }

  /**
   * Create a payment with application fee on the merchant's Square account
   */
  async createPayment(
    tenantId: string,
    amount: number,
    currency: string,
    platformFee: number,
    sourceId: string,
    idempotencyKey: string,
    locationId: string,
    metadata?: Record<string, string>,
  ): Promise<any> {
    const accessToken = await this.squareOAuth.getValidAccessToken(tenantId);

    const body: any = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      location_id: locationId,
      amount_money: {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toUpperCase(),
      },
      app_fee_money: {
        amount: Math.round(platformFee * 100),
        currency: currency.toUpperCase(),
      },
      autocomplete: true,
    };

    if (metadata) {
      body.note = Object.entries(metadata)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
    }

    const response = await fetch(`${this.apiBase}/v2/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-12-18',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Square payment failed: ${error}`);
      throw new BadRequestException('Square payment failed');
    }

    const data = await response.json();
    this.logger.log(
      `Created Square payment ${data.payment?.id} for tenant ${tenantId}: $${amount}`,
    );
    return data.payment;
  }

  /**
   * Get a payment by ID
   */
  async getPayment(tenantId: string, paymentId: string): Promise<any> {
    const accessToken = await this.squareOAuth.getValidAccessToken(tenantId);

    const response = await fetch(`${this.apiBase}/v2/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18',
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to retrieve Square payment');
    }

    const data = await response.json();
    return data.payment;
  }

  /**
   * Refund a Square payment
   */
  async refundPayment(
    tenantId: string,
    paymentId: string,
    amount?: number,
    currency?: string,
    reason?: string,
  ): Promise<any> {
    const accessToken = await this.squareOAuth.getValidAccessToken(tenantId);

    const body: any = {
      idempotency_key: `refund_${paymentId}_${Date.now()}`,
      payment_id: paymentId,
      reason,
    };

    if (amount) {
      body.amount_money = {
        amount: Math.round(amount * 100),
        currency: (currency || 'USD').toUpperCase(),
      };
    }

    const response = await fetch(`${this.apiBase}/v2/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-12-18',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Square refund failed: ${error}`);
      throw new BadRequestException('Square refund failed');
    }

    const data = await response.json();
    this.logger.log(`Created Square refund ${data.refund?.id} for payment ${paymentId}`);
    return data.refund;
  }
}
