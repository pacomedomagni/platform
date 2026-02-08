import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface UpdatePreferencesDto {
  marketing?: boolean;
  orderUpdates?: boolean;
  promotions?: boolean;
  newsletter?: boolean;
}

export interface UnsubscribeType {
  type: 'marketing' | 'orderUpdates' | 'promotions' | 'newsletter' | 'all';
}

@Injectable()
export class EmailPreferencesService {
  private readonly logger = new Logger(EmailPreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get customer email preferences
   */
  async getPreferences(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: { emailPreferences: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // If preferences don't exist yet, create default ones
    if (!customer.emailPreferences) {
      return this.createDefaultPreferences(tenantId, customerId);
    }

    return {
      marketing: customer.emailPreferences.marketing,
      orderUpdates: customer.emailPreferences.orderUpdates,
      promotions: customer.emailPreferences.promotions,
      newsletter: customer.emailPreferences.newsletter,
      unsubscribedAt: customer.emailPreferences.unsubscribedAt,
    };
  }

  /**
   * Update customer email preferences
   */
  async updatePreferences(
    tenantId: string,
    customerId: string,
    dto: UpdatePreferencesDto,
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: { emailPreferences: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Create or update preferences
    const preferences = await this.prisma.storeCustomerPreferences.upsert({
      where: { customerId },
      create: {
        tenantId,
        customerId,
        marketing: dto.marketing ?? true,
        orderUpdates: dto.orderUpdates ?? true,
        promotions: dto.promotions ?? true,
        newsletter: dto.newsletter ?? true,
      },
      update: {
        ...(dto.marketing !== undefined && { marketing: dto.marketing }),
        ...(dto.orderUpdates !== undefined && { orderUpdates: dto.orderUpdates }),
        ...(dto.promotions !== undefined && { promotions: dto.promotions }),
        ...(dto.newsletter !== undefined && { newsletter: dto.newsletter }),
      },
    });

    this.logger.log(`Email preferences updated for customer: ${customer.email}`);

    return {
      marketing: preferences.marketing,
      orderUpdates: preferences.orderUpdates,
      promotions: preferences.promotions,
      newsletter: preferences.newsletter,
      unsubscribedAt: preferences.unsubscribedAt,
    };
  }

  /**
   * Unsubscribe from specific email type or all emails
   */
  async unsubscribe(
    tenantId: string,
    customerId: string,
    type: 'marketing' | 'orderUpdates' | 'promotions' | 'newsletter' | 'all' = 'all',
  ) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
      include: { emailPreferences: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Prepare update data
    const updateData: Prisma.StoreCustomerPreferencesUpdateInput = {};

    if (type === 'all') {
      updateData.marketing = false;
      updateData.orderUpdates = false;
      updateData.promotions = false;
      updateData.newsletter = false;
      updateData.unsubscribedAt = new Date();
    } else {
      updateData[type] = false;
    }

    // Create or update preferences
    const preferences = await this.prisma.storeCustomerPreferences.upsert({
      where: { customerId },
      create: {
        tenantId,
        customerId,
        marketing: type === 'all' || type === 'marketing' ? false : true,
        orderUpdates: type === 'all' || type === 'orderUpdates' ? false : true,
        promotions: type === 'all' || type === 'promotions' ? false : true,
        newsletter: type === 'all' || type === 'newsletter' ? false : true,
        unsubscribedAt: type === 'all' ? new Date() : undefined,
      },
      update: updateData,
    });

    this.logger.log(
      `Customer ${customer.email} unsubscribed from: ${type}`,
    );

    return {
      success: true,
      message: `Successfully unsubscribed from ${type} emails`,
      preferences: {
        marketing: preferences.marketing,
        orderUpdates: preferences.orderUpdates,
        promotions: preferences.promotions,
        newsletter: preferences.newsletter,
      },
    };
  }

  /**
   * Unsubscribe by token (for one-click unsubscribe links)
   */
  async unsubscribeByToken(token: string, type: 'marketing' | 'all' = 'all') {
    // Decode the token to get customerId and tenantId
    const decoded = this.decodeUnsubscribeToken(token);

    if (!decoded) {
      throw new BadRequestException('Invalid unsubscribe token');
    }

    return this.unsubscribe(decoded.tenantId, decoded.customerId, type);
  }

  /**
   * Generate an unsubscribe token for use in email links
   */
  generateUnsubscribeToken(tenantId: string, customerId: string, email: string): string {
    // Create a simple base64-encoded token with HMAC signature
    // Token expires after 30 days
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const data = JSON.stringify({ tenantId, customerId, email, exp });
    const signature = crypto
      .createHmac('sha256', process.env['JWT_SECRET'] || 'dev-secret')
      .update(data)
      .digest('hex');

    const token = Buffer.from(
      JSON.stringify({ data, signature }),
    ).toString('base64url');

    return token;
  }

  /**
   * Decode and verify unsubscribe token
   */
  private decodeUnsubscribeToken(token: string): {
    tenantId: string;
    customerId: string;
    email: string;
  } | null {
    try {
      const decoded = JSON.parse(
        Buffer.from(token, 'base64url').toString('utf-8'),
      );
      const { data, signature } = decoded;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env['JWT_SECRET'] || 'dev-secret')
        .update(data)
        .digest('hex');

      if (signature !== expectedSignature) {
        this.logger.warn('Invalid unsubscribe token signature');
        return null;
      }

      const payload = JSON.parse(data);

      // Check token expiry
      if (payload.exp && Date.now() > payload.exp) {
        this.logger.warn('Unsubscribe token has expired');
        return null;
      }

      return {
        tenantId: payload.tenantId,
        customerId: payload.customerId,
        email: payload.email,
      };
    } catch (error) {
      this.logger.error('Failed to decode unsubscribe token:', error);
      return null;
    }
  }

  /**
   * Check if customer should receive marketing emails
   */
  async shouldReceiveMarketingEmail(tenantId: string, customerId: string): Promise<boolean> {
    const preferences = await this.prisma.storeCustomerPreferences.findFirst({
      where: { tenantId, customerId },
    });

    // If no preferences exist, default to true
    if (!preferences) {
      return true;
    }

    return preferences.marketing;
  }

  /**
   * Check if email is bounced/suppressed
   */
  async isEmailSuppressed(tenantId: string, email: string): Promise<boolean> {
    const bounce = await this.prisma.emailBounce.findFirst({
      where: {
        tenantId,
        email: email.toLowerCase(),
        suppressed: true,
      },
    });

    return !!bounce;
  }

  /**
   * Record email bounce
   */
  async recordBounce(
    tenantId: string,
    email: string,
    type: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'spam',
    reason?: string,
  ) {
    const shouldSuppress = type === 'hard_bounce' || type === 'complaint' || type === 'spam';

    const bounce = await this.prisma.emailBounce.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        type,
        reason,
        suppressed: shouldSuppress,
      },
    });

    this.logger.log(
      `Email bounce recorded: ${email} (${type}, suppressed: ${shouldSuppress})`,
    );

    return bounce;
  }

  /**
   * Create default preferences for a customer
   */
  private async createDefaultPreferences(tenantId: string, customerId: string) {
    const preferences = await this.prisma.storeCustomerPreferences.create({
      data: {
        tenantId,
        customerId,
        marketing: true,
        orderUpdates: true,
        promotions: true,
        newsletter: true,
      },
    });

    return {
      marketing: preferences.marketing,
      orderUpdates: preferences.orderUpdates,
      promotions: preferences.promotions,
      newsletter: preferences.newsletter,
      unsubscribedAt: preferences.unsubscribedAt,
    };
  }
}
