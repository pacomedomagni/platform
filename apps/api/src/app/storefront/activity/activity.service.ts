import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an activity event.
   */
  async logActivity(
    tenantId: string,
    data: {
      entityType: string;
      entityId: string;
      eventType: string;
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
      actorType?: string;
      actorId?: string;
      actorName?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const event = await this.prisma.activityEvent.create({
      data: {
        tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        eventType: data.eventType,
        title: data.title,
        description: data.description,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        actorType: data.actorType,
        actorId: data.actorId,
        actorName: data.actorName,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
      },
    });

    return event;
  }

  /**
   * Get paginated timeline for a specific entity.
   */
  async getTimeline(
    tenantId: string,
    entityType: string,
    entityId: string,
    query: { limit?: number; offset?: number },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const { limit = 20, offset = 0 } = query;

    const where: Prisma.ActivityEventWhereInput = {
      tenantId,
      OR: [
        { entityType, entityId },
        { relatedEntityType: entityType, relatedEntityId: entityId },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityEvent.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  /**
   * Get recent activity across all entities.
   */
  async getRecentActivity(tenantId: string, limit = 20) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const data = await this.prisma.activityEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { data };
  }
}
