/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import {
  ListProductsDto,
  CreateProductListingDto,
  UpdateProductListingDto,
  CreateCategoryDto,
} from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Build orderBy
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
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToDetailResponse(product);
  }

  /**
   * Get a single product by ID (for cart/checkout)
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
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToDetailResponse(product);
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
    // Check if item exists
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, tenantId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Check if slug is unique
    const existingSlug = await this.prisma.productListing.findFirst({
      where: { tenantId, slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException('Product with this slug already exists');
    }

    // Check if item already has a listing
    const existingListing = await this.prisma.productListing.findFirst({
      where: { tenantId, itemId: dto.itemId },
    });

    if (existingListing) {
      throw new ConflictException('Item already has a product listing');
    }

    const product = await this.prisma.productListing.create({
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
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? new Date() : null,
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

    return this.mapProductToDetailResponse(product);
  }

  /**
   * Update a product listing (admin)
   */
  async updateProductListing(tenantId: string, id: string, dto: UpdateProductListingDto) {
    const existing = await this.prisma.productListing.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Product listing not found');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const existingSlug = await this.prisma.productListing.findFirst({
        where: { tenantId, slug: dto.slug, id: { not: id } },
      });

      if (existingSlug) {
        throw new ConflictException('Product with this slug already exists');
      }
    }

    const updateData: Prisma.ProductListingUpdateInput = {
      ...(dto.slug && { slug: dto.slug }),
      ...(dto.displayName && { displayName: dto.displayName }),
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

    // Handle publishing
    if (dto.isPublished !== undefined) {
      updateData.isPublished = dto.isPublished;
      if (dto.isPublished && !existing.isPublished) {
        updateData.publishedAt = new Date();
      }
    }

    const product = await this.prisma.productListing.update({
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

    return this.mapProductToDetailResponse(product);
  }

  /**
   * Create a category (admin)
   */
  async createCategory(tenantId: string, dto: CreateCategoryDto) {
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
  }

  // ============ HELPERS ============

  private mapProductToResponse(product: any) {
    const totalQty = product.item.warehouseItemBalances.reduce(
      (sum: number, b: any) => sum + Number(b.actualQty) - Number(b.reservedQty),
      0
    );

    return {
      id: product.id,
      slug: product.slug,
      displayName: product.displayName,
      shortDescription: product.shortDescription,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      images: product.images,
      badge: product.badge,
      category: product.category,
      stockStatus: this.getStockStatus(totalQty),
      isFeatured: product.isFeatured,
    };
  }

  private mapProductToDetailResponse(product: any) {
    const totalQty = product.item.warehouseItemBalances.reduce(
      (sum: number, b: any) => sum + Number(b.actualQty) - Number(b.reservedQty),
      0
    );

    return {
      ...this.mapProductToResponse(product),
      longDescription: product.longDescription,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      item: {
        code: product.item.code,
        stockUomCode: product.item.stockUomCode,
      },
      availableQuantity: totalQty,
    };
  }

  private mapCategoryToResponse(category: any): any {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
      children: category.children?.map((c: any) => this.mapCategoryToResponse(c)),
    };
  }

  private getStockStatus(qty: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (qty <= 0) return 'out_of_stock';
    if (qty <= 5) return 'low_stock';
    return 'in_stock';
  }
}
