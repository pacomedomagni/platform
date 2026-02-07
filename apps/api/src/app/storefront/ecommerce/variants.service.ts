/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import {
  CreateAttributeTypeDto,
  CreateAttributeValueDto,
  CreateVariantDto,
  UpdateVariantDto,
} from './dto';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ ATTRIBUTE TYPES ============

  async listAttributeTypes(tenantId: string) {
    return this.prisma.itemAttributeType.findMany({
      where: { tenantId },
      include: {
        values: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createAttributeType(tenantId: string, dto: CreateAttributeTypeDto) {
    return this.prisma.itemAttributeType.create({
      data: {
        tenantId,
        name: dto.name.toLowerCase().replace(/\s+/g, '_'),
        displayName: dto.displayName,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        values: true,
      },
    });
  }

  async updateAttributeType(tenantId: string, id: string, dto: Partial<CreateAttributeTypeDto>) {
    const existing = await this.prisma.itemAttributeType.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Attribute type not found');
    }

    return this.prisma.itemAttributeType.update({
      where: { id },
      data: {
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        values: true,
      },
    });
  }

  async deleteAttributeType(tenantId: string, id: string) {
    const existing = await this.prisma.itemAttributeType.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Attribute type not found');
    }

    await this.prisma.itemAttributeType.delete({ where: { id } });
    return { success: true };
  }

  // ============ ATTRIBUTE VALUES ============

  async createAttributeValue(tenantId: string, dto: CreateAttributeValueDto) {
    // Verify attribute type exists and belongs to tenant
    const attributeType = await this.prisma.itemAttributeType.findFirst({
      where: { id: dto.attributeTypeId, tenantId },
    });

    if (!attributeType) {
      throw new NotFoundException('Attribute type not found');
    }

    return this.prisma.itemAttributeValue.create({
      data: {
        tenantId,
        attributeTypeId: dto.attributeTypeId,
        value: dto.value.toLowerCase().replace(/\s+/g, '_'),
        displayValue: dto.displayValue,
        colorHex: dto.colorHex,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateAttributeValue(tenantId: string, id: string, dto: Partial<CreateAttributeValueDto>) {
    const existing = await this.prisma.itemAttributeValue.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Attribute value not found');
    }

    return this.prisma.itemAttributeValue.update({
      where: { id },
      data: {
        ...(dto.displayValue && { displayValue: dto.displayValue }),
        ...(dto.colorHex !== undefined && { colorHex: dto.colorHex }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteAttributeValue(tenantId: string, id: string) {
    const existing = await this.prisma.itemAttributeValue.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Attribute value not found');
    }

    await this.prisma.itemAttributeValue.delete({ where: { id } });
    return { success: true };
  }

  // ============ PRODUCT VARIANTS ============

  async listVariants(tenantId: string, productListingId: string) {
    // Verify product listing exists
    const product = await this.prisma.productListing.findFirst({
      where: { id: productListingId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productVariant.findMany({
      where: { tenantId, productListingId },
      include: {
        attributes: {
          include: {
            attributeType: true,
            attributeValue: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getVariant(tenantId: string, id: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id, tenantId },
      include: {
        attributes: {
          include: {
            attributeType: true,
            attributeValue: true,
          },
        },
        productListing: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  async createVariant(tenantId: string, dto: CreateVariantDto) {
    // Verify product listing exists
    const product = await this.prisma.productListing.findFirst({
      where: { id: dto.productListingId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify all attribute types and values exist
    for (const attr of dto.attributes) {
      const attrType = await this.prisma.itemAttributeType.findFirst({
        where: { id: attr.attributeTypeId, tenantId },
      });
      if (!attrType) {
        throw new BadRequestException(`Attribute type ${attr.attributeTypeId} not found`);
      }

      const attrValue = await this.prisma.itemAttributeValue.findFirst({
        where: { id: attr.attributeValueId, attributeTypeId: attr.attributeTypeId },
      });
      if (!attrValue) {
        throw new BadRequestException(`Attribute value ${attr.attributeValueId} not found`);
      }
    }

    // Create variant with attributes
    return this.prisma.productVariant.create({
      data: {
        tenantId,
        productListingId: dto.productListingId,
        sku: dto.sku,
        barcode: dto.barcode,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        imageUrl: dto.imageUrl,
        stockQty: dto.stockQty ?? 0,
        trackInventory: dto.trackInventory ?? true,
        allowBackorder: dto.allowBackorder ?? false,
        attributes: {
          create: dto.attributes.map((attr) => ({
            attributeTypeId: attr.attributeTypeId,
            attributeValueId: attr.attributeValueId,
          })),
        },
      },
      include: {
        attributes: {
          include: {
            attributeType: true,
            attributeValue: true,
          },
        },
      },
    });
  }

  async updateVariant(tenantId: string, id: string, dto: UpdateVariantDto) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: {
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.compareAtPrice !== undefined && { compareAtPrice: dto.compareAtPrice }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.stockQty !== undefined && { stockQty: dto.stockQty }),
        ...(dto.trackInventory !== undefined && { trackInventory: dto.trackInventory }),
        ...(dto.allowBackorder !== undefined && { allowBackorder: dto.allowBackorder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        attributes: {
          include: {
            attributeType: true,
            attributeValue: true,
          },
        },
      },
    });
  }

  async deleteVariant(tenantId: string, id: string) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Variant not found');
    }

    await this.prisma.productVariant.delete({ where: { id } });
    return { success: true };
  }

  // ============ BULK OPERATIONS ============

  async bulkCreateVariants(tenantId: string, productListingId: string, variants: CreateVariantDto[]) {
    // Verify product listing exists
    const product = await this.prisma.productListing.findFirst({
      where: { id: productListingId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const results = [];
    for (const variant of variants) {
      variant.productListingId = productListingId;
      const created = await this.createVariant(tenantId, variant);
      results.push(created);
    }

    return results;
  }

  async updateVariantStock(tenantId: string, id: string, quantity: number) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: { stockQty: quantity },
    });
  }

  async adjustVariantStock(tenantId: string, id: string, adjustment: number) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Variant not found');
    }

    const currentStock = existing.stockQty ?? 0;
    if (currentStock + adjustment < 0 && !existing.allowBackorder) {
      throw new BadRequestException(
        `Insufficient stock: current ${currentStock}, adjustment ${adjustment}`
      );
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: { stockQty: { increment: adjustment } },
    });
  }
}
