import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@platform/db';

@Injectable()
export class PageSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSections(tenantId: string, pageId: string) {
    return this.prisma.pageSection.findMany({
      where: { tenantId, pageId },
      orderBy: { position: 'asc' },
    });
  }

  async addSection(tenantId: string, pageId: string, dto: {
    type: string;
    config?: Record<string, unknown>;
    position?: number;
  }) {
    const page = await this.prisma.storePage.findFirst({ where: { id: pageId, tenantId } });
    if (!page) throw new NotFoundException('Page not found');

    const maxPos = await this.prisma.pageSection.count({ where: { pageId } });

    return this.prisma.pageSection.create({
      data: {
        tenantId,
        pageId,
        type: dto.type,
        config: (dto.config || {}) as Prisma.InputJsonValue,
        position: dto.position ?? maxPos,
      },
    });
  }

  async updateSection(tenantId: string, sectionId: string, dto: {
    type?: string;
    config?: Record<string, unknown>;
    position?: number;
  }) {
    const section = await this.prisma.pageSection.findFirst({ where: { id: sectionId, tenantId } });
    if (!section) throw new NotFoundException('Section not found');

    return this.prisma.pageSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.config && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });
  }

  async reorderSections(tenantId: string, pageId: string, sectionIds: string[]) {
    const updates = sectionIds.map((id, position) =>
      this.prisma.pageSection.updateMany({
        where: { id, tenantId, pageId },
        data: { position },
      })
    );
    await this.prisma.$transaction(updates);
    return this.listSections(tenantId, pageId);
  }

  async deleteSection(tenantId: string, sectionId: string) {
    const section = await this.prisma.pageSection.findFirst({ where: { id: sectionId, tenantId } });
    if (!section) throw new NotFoundException('Section not found');

    await this.prisma.pageSection.delete({ where: { id: sectionId } });
    return { success: true };
  }
}
