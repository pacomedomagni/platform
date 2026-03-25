import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  ListProductsDto,
  CreateProductListingDto,
  UpdateProductListingDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';
import { CreateSimpleProductDto } from './simple-product.dto';
import { WebhookService } from '../../operations/webhook.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
  ) {}

  /**
   * List published products with filtering, sorting, and pagination
   */
  async listProducts(tenantId: string, dto: ListProductsDto) {
    const {
      categorySlug,
      search,
      featured,
      minPrice,
      maxPrice,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
      limit = 20,
      offset = 0,
    } = dto;

    const where: Prisma.ProductListingWhereInput = {
      tenantId,
      isPublished: true,
      deletedAt: null,
    };

    // Category filter
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    // Search filter
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { item: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Featured filter
    if (featured !== undefined) {
      where.isFeatured = featured;
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    // Handle sales-based sorting separately with aggregate query
    if (sortBy === 'sales') {
      // Use raw aggregate to sort by actual order item count
      const productIds = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT pl."id"
        FROM "product_listings" pl
        LEFT JOIN "order_items" oi ON oi."productId" = pl."id"
        WHERE pl."tenantId" = ${tenantId} AND pl."isPublished" = true
        AND pl."deletedAt" IS NULL
        ${categorySlug ? Prisma.sql`AND EXISTS (SELECT 1 FROM "product_categories" pc WHERE pc."id" = pl."categoryId" AND pc."slug" = ${categorySlug})` : Prisma.empty}
        ${search ? Prisma.sql`AND (pl."displayName" ILIKE ${'%' + search + '%'} OR pl."shortDescription" ILIKE ${'%' + search + '%'})` : Prisma.empty}
        ${minPrice !== undefined ? Prisma.sql`AND pl."price" >= ${minPrice}` : Prisma.empty}
        ${maxPrice !== undefined ? Prisma.sql`AND pl."price" <= ${maxPrice}` : Prisma.empty}
        ${featured === true ? Prisma.sql`AND pl."isFeatured" = true` : Prisma.empty}
        GROUP BY pl."id"
        ORDER BY COUNT(oi."id") ${sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}
        LIMIT ${limit} OFFSET ${offset}
      `;

      const ids = productIds.map(p => p.id);
      const [products, total] = await Promise.all([
        ids.length > 0
          ? this.prisma.productListing.findMany({
              where: { id: { in: ids }, tenantId },
              include: {
                category: { select: { id: true, name: true, slug: true } },
                item: {
                  select: {
                    code: true,
                    warehouseItemBalances: { select: { actualQty: true, reservedQty: true } },
                  },
                },
              },
            })
          : Promise.resolve([]),
        this.prisma.productListing.count({ where }),
      ]);

      // Preserve the order from the raw query
      const orderedProducts = ids.map(id => products.find(p => p.id === id)).filter(Boolean);

      return {
        data: orderedProducts.map((p: typeof products[0]) => this.mapProductToResponse(p)),
        pagination: { total, limit, offset, hasMore: offset + orderedProducts.length < total },
      };
    }

    // Build orderBy for non-sales sorting
    const orderBy: Prisma.ProductListingOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'price':
        orderBy.price = sortOrder;
        break;
      case 'name':
        orderBy.displayName = sortOrder;
        break;
      case 'createdAt':
        orderBy.createdAt = sortOrder;
        break;
      default:
        orderBy.sortOrder = sortOrder;
    }

    const [products, total] = await Promise.all([
      this.prisma.productListing.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          item: {
            select: {
              code: true,
              warehouseItemBalances: {
                select: { actualQty: true, reservedQty: true },
              },
            },
          },
        },
      }),
      this.prisma.productListing.count({ where }),
    ]);

    return {
      data: products.map((p) => this.mapProductToResponse(p)),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + products.length < total,
      },
    };
  }

  /**
   * Get a single product by slug (public)
   */
  async getProductBySlug(tenantId: string, slug: string) {
    const product = await this.prisma.productListing.findFirst({
      where: {
        tenantId,
        slug,
        isPublished: true,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        item: {
          select: {
            code: true,
            stockUomCode: true,
            warehouseItemBalances: {
              select: { actualQty: true, reservedQty: true },
            },
          },
        },
        variants: {
          include: {
            attributes: {
              include: {
                attributeType: true,
                attributeValue: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToDetailResponse(product);
  }

  /**
   * Get a single product by ID (for cart/checkout, published only)
   */
  async getProductById(tenantId: string, id: string) {
    const product = await this.prisma.productListing.findFirst({
      where: {
        tenantId,
        id,
        isPublished: true,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        item: {
          select: {
            code: true,
            stockUomCode: true,
            warehouseItemBalances: {
              select: { actualQty: true, reservedQty: true },
            },
          },
        },
        variants: {
          include: {
            attributes: {
              include: {
                attributeType: true,
                attributeValue: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToDetailResponse(product);
  }

  /**
   * Get a single product by ID for admin (includes unpublished)
   */
  async getProductByIdAdmin(tenantId: string, id: string) {
    const product = await this.prisma.productListing.findFirst({
      where: { tenantId, id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        item: {
          select: {
            code: true,
            stockUomCode: true,
            warehouseItemBalances: {
              select: { actualQty: true, reservedQty: true },
            },
          },
        },
        variants: {
          include: {
            attributes: {
              include: {
                attributeType: true,
                attributeValue: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product listing not found');
    }

    return {
      ...this.mapProductToDetailResponse(product),
      isPublished: product.isPublished,
    };
  }

  /**
   * List all categories
   */
  async listCategories(tenantId: string) {
    const categories = await this.prisma.productCategory.findMany({
      where: {
        tenantId,
        isActive: true,
        parentId: null, // Top-level only
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            products: {
              where: { isPublished: true },
            },
          },
        },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: {
                products: {
                  where: { isPublished: true },
                },
              },
            },
          },
        },
      },
    });

    return categories.map((c) => this.mapCategoryToResponse(c));
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(tenantId: string, slug: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: {
        tenantId,
        slug,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            products: {
              where: { isPublished: true },
            },
          },
        },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: {
                products: {
                  where: { isPublished: true },
                },
              },
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.mapCategoryToResponse(category);
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(tenantId: string, limit = 8) {
    const products = await this.prisma.productListing.findMany({
      where: {
        tenantId,
        isPublished: true,
        isFeatured: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: limit,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        item: {
          select: {
            code: true,
            warehouseItemBalances: {
              select: { actualQty: true, reservedQty: true },
            },
          },
        },
      },
    });

    return products.map((p) => this.mapProductToResponse(p));
  }

  // ============ ADMIN METHODS ============

  /**
   * Create a new product listing (admin)
   */
  async createProductListing(tenantId: string, dto: CreateProductListingDto) {
    // Use transaction to make validation + creation atomic (prevent TOCTOU race on slug)
    const product = await this.prisma.$transaction(async (tx) => {
      // Check if item exists
      const item = await tx.item.findFirst({
        where: { id: dto.itemId, tenantId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      // Check if slug is unique
      const existingSlug = await tx.productListing.findFirst({
        where: { tenantId, slug: dto.slug },
      });

      if (existingSlug) {
        throw new ConflictException('Product with this slug already exists');
      }

      // Check if item already has a listing
      const existingListing = await tx.productListing.findFirst({
        where: { tenantId, itemId: dto.itemId },
      });

      if (existingListing) {
        throw new ConflictException('Item already has a product listing');
      }

      // Validate price is positive if set
      if (dto.price !== undefined && Number(dto.price) < 0) {
        throw new BadRequestException('Price cannot be negative');
      }

      const shouldPublish = dto.isPublished === true;

      // Validate required fields before publishing
      if (shouldPublish) {
        if (!dto.displayName || !dto.displayName.trim()) {
          throw new BadRequestException('Product must have a display name before publishing');
        }
        if (dto.price === undefined || dto.price === null || Number(dto.price) <= 0) {
          throw new BadRequestException('Product must have a valid price before publishing');
        }
        if (!dto.images?.length) {
          throw new BadRequestException('Product must have at least one image before publishing');
        }
        if (!dto.categoryId) {
          throw new BadRequestException('Product must be assigned to a category before publishing');
        }
        const category = await tx.productCategory.findFirst({
          where: { id: dto.categoryId, tenantId },
        });
        if (!category) {
          throw new BadRequestException('Assigned category does not exist');
        }
      }

      return tx.productListing.create({
        data: {
          tenantId,
          itemId: dto.itemId,
          slug: dto.slug,
          displayName: dto.displayName,
          shortDescription: dto.shortDescription,
          longDescription: dto.longDescription,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          images: dto.images || [],
          categoryId: dto.categoryId,
          badge: dto.badge,
          isFeatured: dto.isFeatured ?? false,
          isPublished: shouldPublish,
          publishedAt: shouldPublish ? new Date() : null,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          item: {
            select: {
              code: true,
              stockUomCode: true,
              warehouseItemBalances: {
                select: { actualQty: true, reservedQty: true },
              },
            },
          },
        },
      });
    });

    // Fire-and-forget: trigger product.created webhook
    this.webhookService.triggerEvent({ tenantId }, {
      event: 'product.created',
      payload: {
        productId: product.id,
        slug: product.slug,
        displayName: product.displayName,
        price: product.price ? Number(product.price) : null,
        isPublished: product.isPublished,
      },
      timestamp: new Date(),
    }).catch(() => { /* silent */ });

    return this.mapProductToDetailResponse(product);
  }

  /**
   * Update a product listing (admin)
   */
  async updateProductListing(tenantId: string, id: string, dto: UpdateProductListingDto) {
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.productListing.findFirst({
          where: { id, tenantId },
        });

        if (!existing) {
          throw new NotFoundException('Product listing not found');
        }

        // Check slug uniqueness if changing
        if (dto.slug !== undefined && dto.slug !== existing.slug) {
          const existingSlug = await tx.productListing.findFirst({
            where: { tenantId, slug: dto.slug, id: { not: id } },
          });

          if (existingSlug) {
            throw new ConflictException('Product with this slug already exists');
          }
        }

        const updateData: Prisma.ProductListingUpdateInput = {
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription }),
          ...(dto.longDescription !== undefined && { longDescription: dto.longDescription }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.compareAtPrice !== undefined && { compareAtPrice: dto.compareAtPrice }),
          ...(dto.images && { images: dto.images }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.badge !== undefined && { badge: dto.badge }),
          ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
          ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
          ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
        };

        // Handle publishing with validation
        if (dto.isPublished !== undefined) {
          if (dto.isPublished && !existing.isPublished) {
            // Validate required fields before publishing
            const displayName = dto.displayName || existing.displayName;
            const price = dto.price ?? existing.price;
            const categoryId = dto.categoryId || existing.categoryId;

            if (!displayName || !displayName.trim()) {
              throw new BadRequestException('Product must have a display name before publishing');
            }
            if (price === null || price === undefined || Number(price) <= 0) {
              throw new BadRequestException('Product must have a valid price before publishing');
            }
            if (!existing.images?.length && !dto.images?.length) {
              throw new BadRequestException('Product must have at least one image before publishing');
            }
            if (!categoryId) {
              throw new BadRequestException('Product must be assigned to a category before publishing');
            }
            // Verify category exists and belongs to this tenant
            const category = await tx.productCategory.findFirst({
              where: { id: categoryId, tenantId },
            });
            if (!category) {
              throw new BadRequestException('Assigned category does not exist');
            }

            updateData.publishedAt = new Date();
          }
          updateData.isPublished = dto.isPublished;
        }

        return tx.productListing.update({
          where: { id },
          data: updateData,
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
            item: {
              select: {
                code: true,
                stockUomCode: true,
                warehouseItemBalances: {
                  select: { actualQty: true, reservedQty: true },
                },
              },
            },
          },
        });
      });

      // Fire-and-forget: trigger product.updated webhook
      this.webhookService.triggerEvent({ tenantId }, {
        event: 'product.updated',
        payload: {
          productId: product.id,
          slug: product.slug,
          displayName: product.displayName,
          price: product.price ? Number(product.price) : null,
          isPublished: product.isPublished,
        },
        timestamp: new Date(),
      }).catch(() => { /* silent */ });

      return this.mapProductToDetailResponse(product);
    } catch (error: unknown) {
      // Handle P2002 unique constraint violation (slug race condition)
      const prismaError = error as { code?: string; meta?: { target?: string[] } };
      if (prismaError.code === 'P2002') {
        throw new ConflictException('Product with this slug already exists');
      }
      throw error;
    }
  }

  /**
   * Soft-delete a product listing (admin)
   */
  async deleteProduct(tenantId: string, id: string) {
    const existing = await this.prisma.productListing.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Product listing not found');
    }

    await this.prisma.productListing.update({
      where: { id },
      data: {
        isPublished: false,
        deletedAt: new Date(),
      },
    });

    // Fire-and-forget: trigger product.deleted webhook
    this.webhookService.triggerEvent({ tenantId }, {
      event: 'product.deleted',
      payload: {
        productId: id,
        slug: existing.slug,
        displayName: existing.displayName,
      },
      timestamp: new Date(),
    }).catch(() => { /* silent */ });

    return { success: true };
  }

  /**
   * Create a category (admin)
   */
  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    try {
      // Validate parentId belongs to the same tenant
      if (dto.parentId) {
        const parentCategory = await this.prisma.productCategory.findFirst({
          where: { id: dto.parentId, tenantId },
        });
        if (!parentCategory) {
          throw new BadRequestException('Parent category not found');
        }
      }

      // Check slug uniqueness
      const existingSlug = await this.prisma.productCategory.findFirst({
        where: { tenantId, slug: dto.slug },
      });

      if (existingSlug) {
        throw new ConflictException('Category with this slug already exists');
      }

      const category = await this.prisma.productCategory.create({
        data: {
          tenantId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          imageUrl: dto.imageUrl,
          parentId: dto.parentId,
          sortOrder: dto.sortOrder ?? 0,
          isActive: true,
        },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        productCount: category._count.products,
      };
    } catch (error: unknown) {
      // M11: Handle P2002 unique constraint violation (slug race condition)
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        throw new ConflictException('Category with this slug already exists');
      }
      throw error;
    }
  }

  /**
   * Update a category (admin)
   */
  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    try {
      const existing = await this.prisma.productCategory.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new NotFoundException('Category not found');
      }

      // Validate parentId belongs to the same tenant
      if (dto.parentId !== undefined && dto.parentId !== null) {
        const parentCategory = await this.prisma.productCategory.findFirst({
          where: { id: dto.parentId, tenantId },
        });
        if (!parentCategory) {
          throw new BadRequestException('Parent category not found');
        }
        // Prevent self-referencing
        if (dto.parentId === id) {
          throw new BadRequestException('Category cannot be its own parent');
        }
      }

      // Check slug uniqueness if changing
      if (dto.slug && dto.slug !== existing.slug) {
        const existingSlug = await this.prisma.productCategory.findFirst({
          where: { tenantId, slug: dto.slug, id: { not: id } },
        });
        if (existingSlug) {
          throw new ConflictException('Category with this slug already exists');
        }
      }

      const updated = await this.prisma.productCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        imageUrl: updated.imageUrl,
        isActive: updated.isActive,
        productCount: updated._count.products,
      };
    } catch (error: unknown) {
      // M11: Handle P2002 unique constraint violation (slug race condition)
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        throw new ConflictException('Category with this slug already exists');
      }
      throw error;
    }
  }

  /**
   * Soft-delete a category (admin)
   */
  async deleteCategory(tenantId: string, id: string) {
    const existing = await this.prisma.productCategory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.productCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  /**
   * Create a product with auto-generated ERP Item (merchant-friendly)
   */
  async createSimpleProduct(tenantId: string, dto: CreateSimpleProductDto) {
    // Fix #15: Wrap entire operation in a transaction for atomicity
    return this.prisma.$transaction(async (tx) => {
      // Auto-generate item code
      const code = `PRD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // Ensure "Each" UOM exists
      await tx.uom.upsert({
        where: { code: 'EACH' },
        update: {},
        create: { code: 'EACH', name: 'Each' },
      });

      // Find first active warehouse for this tenant
      const warehouse = await tx.warehouse.findFirst({
        where: { tenantId, isActive: true, deletedAt: null },
      });

      // Create the ERP Item
      const item = await tx.item.create({
        data: {
          tenantId,
          code,
          name: dto.name,
          stockUomCode: 'EACH',
          isStockItem: true,
          isActive: true,
        },
      });

      // If warehouse exists, create a WarehouseItemBalance so stock tracking works
      if (warehouse) {
        await tx.warehouseItemBalance.create({
          data: {
            tenantId,
            itemId: item.id,
            warehouseId: warehouse.id,
            actualQty: 0,
            reservedQty: 0,
          },
        }).catch((err: any) => {
          if (err?.code === 'P2002') {
            // Balance already exists for this item+warehouse — ignore
            return;
          }
          throw err; // Re-throw non-duplicate errors
        });
      }

      // Generate slug from name
      const baseSlug = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80);

      // Ensure slug uniqueness
      let slug = baseSlug;
      const existingSlug = await tx.productListing.findFirst({
        where: { tenantId, slug },
      });
      if (existingSlug) {
        slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
      }

      // Check if slug is unique (within transaction)
      const existingSlugFinal = await tx.productListing.findFirst({
        where: { tenantId, slug },
      });
      if (existingSlugFinal) {
        throw new ConflictException('Product with this slug already exists');
      }

      // Check if item already has a listing
      const existingListing = await tx.productListing.findFirst({
        where: { tenantId, itemId: item.id },
      });
      if (existingListing) {
        throw new ConflictException('Item already has a product listing');
      }

      const shouldPublish = dto.isPublished ?? true;

      // Validate required fields before publishing
      if (shouldPublish) {
        if (!dto.name || !dto.name.trim()) {
          throw new BadRequestException('Product must have a display name before publishing');
        }
        if (dto.price === undefined || dto.price === null || Number(dto.price) <= 0) {
          throw new BadRequestException('Product must have a valid price before publishing');
        }
        if (!dto.images?.length) {
          throw new BadRequestException('Product must have at least one image before publishing');
        }
        if (!dto.categoryId) {
          throw new BadRequestException('Product must be assigned to a category before publishing');
        }
        const category = await tx.productCategory.findFirst({
          where: { id: dto.categoryId, tenantId },
        });
        if (!category) {
          throw new BadRequestException('Assigned category does not exist');
        }
      }

      const product = await tx.productListing.create({
        data: {
          tenantId,
          itemId: item.id,
          slug,
          displayName: dto.name,
          shortDescription: dto.description,
          longDescription: dto.longDescription,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          images: dto.images || [],
          categoryId: dto.categoryId,
          isFeatured: dto.isFeatured ?? false,
          isPublished: shouldPublish,
          publishedAt: shouldPublish ? new Date() : null,
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          item: {
            select: {
              code: true,
              stockUomCode: true,
              warehouseItemBalances: {
                select: { actualQty: true, reservedQty: true },
              },
            },
          },
        },
      });

      // Fire-and-forget: trigger product.created webhook
      this.webhookService.triggerEvent({ tenantId }, {
        event: 'product.created',
        payload: {
          productId: product.id,
          slug: product.slug,
          displayName: product.displayName,
          price: product.price ? Number(product.price) : null,
          isPublished: product.isPublished,
        },
        timestamp: new Date(),
      }).catch(() => { /* silent */ });

      return this.mapProductToDetailResponse(product);
    });
  }

  /**
   * List all products for admin (including unpublished)
   */
  async listAdminProducts(tenantId: string, dto: ListProductsDto) {
    const {
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = dto;

    const where: Prisma.ProductListingWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProductListingOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'price': orderBy.price = sortOrder; break;
      case 'name': orderBy.displayName = sortOrder; break;
      default: orderBy.createdAt = sortOrder;
    }

    const [products, total] = await Promise.all([
      this.prisma.productListing.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          item: {
            select: {
              code: true,
              warehouseItemBalances: {
                select: { actualQty: true, reservedQty: true },
              },
            },
          },
        },
      }),
      this.prisma.productListing.count({ where }),
    ]);

    return {
      data: products.map((p) => ({
        ...this.mapProductToResponse(p),
        isPublished: p.isPublished,
      })),
      pagination: { total, limit, offset, hasMore: offset + products.length < total },
    };
  }

  // ============ HELPERS ============

  private mapProductToResponse(product: {
    id: string; slug: string; displayName: string; shortDescription: string | null;
    price: Prisma.Decimal | number | null; compareAtPrice: Prisma.Decimal | number | null;
    images: string[] | Prisma.JsonValue; badge: string | null;
    category: { id: string; name: string; slug: string } | null;
    isFeatured: boolean;
    item: { code: string; warehouseItemBalances: Array<{ actualQty: Prisma.Decimal | number; reservedQty: Prisma.Decimal | number }> };
  }) {
    const totalQty = product.item.warehouseItemBalances.reduce(
      (sum: number, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
      0
    );

    return {
      id: product.id,
      slug: product.slug,
      displayName: product.displayName,
      shortDescription: product.shortDescription,
      price: product.price !== null ? Number(product.price) : null,
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      images: product.images,
      badge: product.badge,
      category: product.category,
      stockStatus: this.getStockStatus(totalQty),
      isFeatured: product.isFeatured,
    };
  }

  private mapProductToDetailResponse(product: Record<string, unknown>) {
    const p = product as Record<string, unknown> & {
      item: { code: string; stockUomCode?: string | null; warehouseItemBalances: Array<{ actualQty: Prisma.Decimal | number; reservedQty: Prisma.Decimal | number }> };
      longDescription?: string | null; metaTitle?: string | null; metaDescription?: string | null;
      averageRating?: Prisma.Decimal | number | null; reviewCount?: number;
      variants?: Array<Record<string, unknown>>;
    };

    const totalQty = p.item.warehouseItemBalances.reduce(
      (sum: number, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
      0
    );

    return {
      ...this.mapProductToResponse(product as Parameters<typeof this.mapProductToResponse>[0]),
      longDescription: p.longDescription,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      item: {
        code: p.item.code,
        stockUomCode: p.item.stockUomCode,
      },
      availableQuantity: totalQty,
      averageRating: p.averageRating ? Number(p.averageRating) : null,
      reviewCount: p.reviewCount,
      variants: p.variants?.map((v: Record<string, unknown>) => ({
        id: v.id,
        sku: v.sku,
        price: v.price ? Number(v.price) : null,
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
        imageUrl: v.imageUrl,
        stockQty: v.stockQty,
        trackInventory: v.trackInventory,
        allowBackorder: v.allowBackorder,
        attributes: (v.attributes as Array<Record<string, unknown>>)?.map((a: Record<string, unknown>) => ({
          type: (a.attributeType as Record<string, string>)?.displayName || (a.attributeType as Record<string, string>)?.name,
          value: (a.attributeValue as Record<string, string>)?.displayValue || (a.attributeValue as Record<string, string>)?.value,
        })),
      })) || [],
    };
  }

  private mapCategoryToResponse(category: {
    id: string; name: string; slug: string;
    description: string | null; imageUrl: string | null;
    _count: { products: number };
    children?: Array<Record<string, unknown>>;
  }): Record<string, unknown> {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
      children: category.children?.map((c) => this.mapCategoryToResponse(c as Parameters<typeof this.mapCategoryToResponse>[0])),
    };
  }

  private getStockStatus(qty: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (qty <= 0) return 'out_of_stock';
    if (qty <= 5) return 'low_stock';
    return 'in_stock';
  }
}
