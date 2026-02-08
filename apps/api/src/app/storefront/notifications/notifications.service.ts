import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import twilio from 'twilio';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listChannels(tenantId: string) {
    const channels = await this.prisma.notificationChannel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return channels;
  }

  async createChannel(
    tenantId: string,
    data: {
      type: string;
      provider: string;
      config: Record<string, unknown>;
    },
  ) {
    // Check for duplicate channel type per tenant
    const existing = await this.prisma.notificationChannel.findUnique({
      where: { tenantId_type: { tenantId, type: data.type } },
    });

    if (existing) {
      throw new BadRequestException(
        `A ${data.type} channel already exists for this tenant`,
      );
    }

    return this.prisma.notificationChannel.create({
      data: {
        tenantId,
        type: data.type,
        provider: data.provider,
        config: data.config as Prisma.InputJsonValue,
      },
    });
  }

  async updateChannel(
    tenantId: string,
    id: string,
    data: {
      provider?: string;
      config?: Record<string, unknown>;
      isActive?: boolean;
      orderConfirmationEnabled?: boolean;
      shippingUpdateEnabled?: boolean;
      deliveryConfirmEnabled?: boolean;
      abandonedCartEnabled?: boolean;
    },
  ) {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: { id, tenantId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return this.prisma.notificationChannel.update({
      where: { id },
      data: {
        ...(data.provider !== undefined && { provider: data.provider }),
        ...(data.config !== undefined && { config: data.config as Prisma.InputJsonValue }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.orderConfirmationEnabled !== undefined && {
          orderConfirmationEnabled: data.orderConfirmationEnabled,
        }),
        ...(data.shippingUpdateEnabled !== undefined && {
          shippingUpdateEnabled: data.shippingUpdateEnabled,
        }),
        ...(data.deliveryConfirmEnabled !== undefined && {
          deliveryConfirmEnabled: data.deliveryConfirmEnabled,
        }),
        ...(data.abandonedCartEnabled !== undefined && {
          abandonedCartEnabled: data.abandonedCartEnabled,
        }),
      },
    });
  }

  async deleteChannel(tenantId: string, id: string) {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: { id, tenantId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    await this.prisma.notificationChannel.delete({ where: { id } });

    return { success: true };
  }

  async sendNotification(
    tenantId: string,
    data: {
      channelId: string;
      recipient: string;
      messageType: string;
      content: string;
    },
  ) {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: { id: data.channelId, tenantId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (!channel.isActive) {
      throw new BadRequestException('Channel is not active');
    }

    // Create notification log entry
    const log = await this.prisma.notificationLog.create({
      data: {
        tenantId,
        channelId: data.channelId,
        recipient: data.recipient,
        messageType: data.messageType,
        content: data.content,
        status: 'pending',
      },
    });

    // Attempt to send via provider (placeholder implementation)
    // In production, this would call Twilio/MessageBird/etc.
    try {
      const externalId = await this.dispatchToProvider(channel, data);

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          externalId,
        },
      });

      return {
        success: true,
        logId: log.id,
        status: 'sent',
        externalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      });

      return {
        success: false,
        logId: log.id,
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  async sendOrderNotification(tenantId: string, orderId: string, messageType: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: { select: { name: true, quantity: true, totalPrice: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Build message content based on messageType
    let content = '';
    const customerName = order.customer
      ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim()
      : order.email;

    switch (messageType) {
      case 'order_confirmation':
        content = `Hi ${customerName}, your order #${order.orderNumber} has been confirmed! Total: $${Number(order.grandTotal).toFixed(2)}. Items: ${order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}.`;
        break;
      case 'shipping_update':
        content = `Hi ${customerName}, your order #${order.orderNumber} has been shipped!${order.trackingNumber ? ` Tracking: ${order.trackingNumber}` : ''} Carrier: ${order.shippingCarrier ?? 'N/A'}.`;
        break;
      case 'delivery_confirmation':
        content = `Hi ${customerName}, your order #${order.orderNumber} has been delivered! Thank you for shopping with us.`;
        break;
      default:
        content = `Update on your order #${order.orderNumber}: ${messageType}`;
    }

    // Find the appropriate channel (prefer WhatsApp, fallback to SMS)
    const recipient = order.customer?.phone || order.phone;
    if (!recipient) {
      throw new BadRequestException('No phone number available for this order');
    }

    const channel = await this.prisma.notificationChannel.findFirst({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['whatsapp', 'sms'] },
      },
      orderBy: { type: 'desc' }, // whatsapp before sms alphabetically (desc)
    });

    if (!channel) {
      throw new BadRequestException('No active SMS/WhatsApp channel configured');
    }

    return this.sendNotification(tenantId, {
      channelId: channel.id,
      recipient,
      messageType,
      content,
    });
  }

  async listLogs(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      channelId?: string;
      status?: string;
      messageType?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.channelId) {
      where.channelId = query.channelId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.messageType) {
      where.messageType = query.messageType;
    }

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          channel: { select: { type: true, provider: true } },
        },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        ...log,
        cost: log.cost ? Number(log.cost) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getNotificationStats(tenantId: string) {
    const [totalSent, totalDelivered, totalFailed, costAgg] = await Promise.all([
      this.prisma.notificationLog.count({
        where: { tenantId, status: 'sent' },
      }),
      this.prisma.notificationLog.count({
        where: { tenantId, status: 'delivered' },
      }),
      this.prisma.notificationLog.count({
        where: { tenantId, status: 'failed' },
      }),
      this.prisma.notificationLog.aggregate({
        where: { tenantId, cost: { not: null } },
        _sum: { cost: true },
      }),
    ]);

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      cost: Number(costAgg._sum.cost ?? 0),
    };
  }

  private async dispatchToProvider(
    channel: { type: string; provider: string; config: unknown },
    data: { recipient: string; content: string },
  ): Promise<string | null> {
    const providerKey = channel.provider.toLowerCase();
    const provider = PROVIDERS[providerKey];

    if (!provider) {
        throw new BadRequestException(
        `Provider "${channel.provider}" is not supported. Supported: ${Object.keys(PROVIDERS).join(', ')}`,
        );
    }

    const isWhatsApp = channel.type.toLowerCase() === 'whatsapp';
    
    try {
        const sid = await provider.send(channel.config, data.recipient, data.content, isWhatsApp);
        this.logger.log(`Sent via ${channel.provider} (${channel.type}): ${sid}`);
        return sid;
    } catch (e) {
        this.logger.error(`Failed to send via ${channel.provider}: ${e.message}`, e.stack);
        throw e;
    }
  }
}

// --- Provider Abstraction ---

interface NotificationProvider {
  send(config: any, recipient: string, content: string, isWhatsApp: boolean): Promise<string>;
}

class TwilioProvider implements NotificationProvider {
  async send(config: any, recipient: string, content: string, isWhatsApp: boolean): Promise<string> {
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        throw new BadRequestException(
          'Twilio credentials not configured. Please set Account SID, Auth Token, and From Number.',
        );
      }
      const client = twilio(config.accountSid, config.authToken);
      const from = isWhatsApp ? `whatsapp:${config.fromNumber}` : config.fromNumber;
      const to = isWhatsApp ? `whatsapp:${recipient}` : recipient;

      const message = await client.messages.create({ body: content, from, to });
      return message.sid;
  }
}

class MockProvider implements NotificationProvider {
  async send(config: any, recipient: string, content: string, isWhatsApp: boolean): Promise<string> {
     Logger.log(`[MockProvider] Sending ${isWhatsApp ? 'WhatsApp' : 'SMS'} to ${recipient}: ${content}`);
     // Simulate latency
     await new Promise(r => setTimeout(r, 100));
     return `mock-${Date.now()}`;
  }
}

const PROVIDERS: Record<string, NotificationProvider> = {
  'twilio': new TwilioProvider(),
  'mock': new MockProvider(),
};
