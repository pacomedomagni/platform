import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { UpsertStorePageDto } from './store-pages.dto';

@Injectable()
export class StorePagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPages(tenantId: string, publishedOnly = true) {
    const where: any = { tenantId };
    if (publishedOnly) {
      where.isPublished = true;
    }

    const pages = await this.prisma.storePage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        isPublished: true,
        updatedAt: true,
      },
    });

    return pages;
  }

  async getPage(tenantId: string, slug: string) {
    const page = await this.prisma.storePage.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    if (!page) {
      throw new NotFoundException(`Page "${slug}" not found`);
    }

    return page;
  }

  async upsertPage(tenantId: string, slug: string, dto: UpsertStorePageDto) {
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    return this.prisma.storePage.upsert({
      where: { tenantId_slug: { tenantId, slug: normalizedSlug } },
      create: {
        tenantId,
        slug: normalizedSlug,
        title: dto.title,
        content: dto.content,
        isPublished: dto.isPublished ?? true,
      },
      update: {
        title: dto.title,
        content: dto.content,
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      },
    });
  }

  async deletePage(tenantId: string, slug: string) {
    const page = await this.prisma.storePage.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });

    if (!page) {
      throw new NotFoundException(`Page "${slug}" not found`);
    }

    await this.prisma.storePage.delete({
      where: { id: page.id },
    });

    return { deleted: true };
  }
}
