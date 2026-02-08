import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Notes ──────────────────────────────────────────────────

  /**
   * List notes for a store customer with pagination.
   */
  async listNotes(
    tenantId: string,
    storeCustomerId: string,
    query: { limit?: number; offset?: number },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const { limit = 20, offset = 0 } = query;

    const where: Prisma.CustomerNoteWhereInput = {
      tenantId,
      storeCustomerId,
    };

    const [data, total] = await Promise.all([
      this.prisma.customerNote.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.customerNote.count({ where }),
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
   * Create a note for a customer.
   */
  async createNote(
    tenantId: string,
    data: {
      storeCustomerId: string;
      content: string;
      createdBy?: string;
      isPinned?: boolean;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const note = await this.prisma.customerNote.create({
      data: {
        tenantId,
        storeCustomerId: data.storeCustomerId,
        content: data.content,
        createdBy: data.createdBy,
        isPinned: data.isPinned ?? false,
      },
    });

    return note;
  }

  /**
   * Update a note: content, pin/unpin.
   */
  async updateNote(
    tenantId: string,
    id: string,
    data: { content?: string; isPinned?: boolean },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const note = await this.prisma.customerNote.findFirst({
      where: { id, tenantId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const updated = await this.prisma.customerNote.update({
      where: { id },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
      },
    });

    return updated;
  }

  /**
   * Delete a note.
   */
  async deleteNote(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const note = await this.prisma.customerNote.findFirst({
      where: { id, tenantId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.customerNote.delete({ where: { id } });

    return { success: true, id };
  }

  // ─── Tags ──────────────────────────────────────────────────

  /**
   * List all tags for a tenant.
   */
  async listTags(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const tags = await this.prisma.customerTag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { links: true },
        },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      customerCount: tag._count.links,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }));
  }

  /**
   * Create a tag (name, color).
   */
  async createTag(
    tenantId: string,
    data: { name: string; color?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Check for uniqueness
    const existing = await this.prisma.customerTag.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      throw new ConflictException('Tag with this name already exists');
    }

    const tag = await this.prisma.customerTag.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color || '#6B7280',
      },
    });

    return tag;
  }

  /**
   * Delete a tag.
   */
  async deleteTag(tenantId: string, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const tag = await this.prisma.customerTag.findFirst({
      where: { id, tenantId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Cascade delete will handle links
    await this.prisma.customerTag.delete({ where: { id } });

    return { success: true, id };
  }

  /**
   * Link a tag to a customer.
   */
  async tagCustomer(tenantId: string, tagId: string, storeCustomerId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify tag exists
    const tag = await this.prisma.customerTag.findFirst({
      where: { id: tagId, tenantId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if already linked
    const existing = await this.prisma.customerTagLink.findFirst({
      where: { tagId, storeCustomerId },
    });

    if (existing) {
      throw new ConflictException('Customer already has this tag');
    }

    const link = await this.prisma.customerTagLink.create({
      data: {
        tenantId,
        tagId,
        storeCustomerId,
      },
      include: {
        tag: true,
      },
    });

    return {
      id: link.id,
      tagId: link.tagId,
      storeCustomerId: link.storeCustomerId,
      tag: {
        id: link.tag.id,
        name: link.tag.name,
        color: link.tag.color,
      },
    };
  }

  /**
   * Unlink a tag from a customer.
   */
  async untagCustomer(tenantId: string, tagId: string, storeCustomerId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const link = await this.prisma.customerTagLink.findFirst({
      where: { tagId, storeCustomerId, tenantId },
    });

    if (!link) {
      throw new NotFoundException('Tag link not found');
    }

    await this.prisma.customerTagLink.delete({ where: { id: link.id } });

    return { success: true, tagId, storeCustomerId };
  }

  /**
   * Get all tags for a customer.
   */
  async getCustomerTags(tenantId: string, storeCustomerId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const links = await this.prisma.customerTagLink.findMany({
      where: { tenantId, storeCustomerId },
      include: {
        tag: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.tag.id,
      name: link.tag.name,
      color: link.tag.color,
      linkedAt: link.createdAt,
    }));
  }
}
