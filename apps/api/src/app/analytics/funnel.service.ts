import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@platform/db';

@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(tenantId: string, dto: {
    sessionId: string;
    customerId?: string;
    eventType: string;
    productId?: string;
    metadata?: Record<string, unknown>;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
  }) {
    return this.prisma.funnelEvent.create({
      data: {
        tenantId,
        sessionId: dto.sessionId,
        customerId: dto.customerId,
        eventType: dto.eventType,
        productId: dto.productId,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        referrer: dto.referrer,
      },
    });
  }

  async getConversionFunnel(tenantId: string, query: { from?: string; to?: string }) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.from) dateFilter.gte = new Date(query.from);
    if (query.to) dateFilter.lte = new Date(query.to);

    const where = {
      tenantId,
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const stages = ['page_view', 'product_view', 'add_to_cart', 'begin_checkout', 'purchase'];

    const counts = await Promise.all(
      stages.map(async (eventType) => {
        const count = await this.prisma.funnelEvent.groupBy({
          by: ['sessionId'],
          where: { ...where, eventType },
        });
        return { stage: eventType, uniqueSessions: count.length };
      })
    );

    const funnel = counts.map((stage, idx) => ({
      stage: stage.stage,
      sessions: stage.uniqueSessions,
      conversionRate: idx === 0
        ? 100
        : counts[0].uniqueSessions > 0
          ? Math.round((stage.uniqueSessions / counts[0].uniqueSessions) * 10000) / 100
          : 0,
      dropoff: idx > 0 && counts[idx - 1].uniqueSessions > 0
        ? Math.round(((counts[idx - 1].uniqueSessions - stage.uniqueSessions) / counts[idx - 1].uniqueSessions) * 10000) / 100
        : 0,
    }));

    return { funnel, period: { from: query.from, to: query.to } };
  }

  async getTopSources(tenantId: string, query: { from?: string; to?: string; limit?: number }) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.from) dateFilter.gte = new Date(query.from);
    if (query.to) dateFilter.lte = new Date(query.to);

    const where = {
      tenantId,
      utmSource: { not: null },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const sources = await this.prisma.funnelEvent.groupBy({
      by: ['utmSource'],
      where: where as any,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: query.limit || 10,
    });

    return sources.map((s) => ({ source: s.utmSource, count: s._count.id }));
  }
}
