/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  CreateWishlistDto,
  AddWishlistItemDto,
} from './dto';

type WishlistWithRelations = Prisma.WishlistGetPayload<{
  include: {
    customer: {
      select: { firstName: true };
    };
    items: {
      include: {
        productListing: {
          include: {
            category: true;
          };
        };
        variant: {
          include: {
            attributes: {
              include: {
                attributeType: true;
                attributeValue: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ WISHLIST MANAGEMENT ============

  async getWishlists(tenantId: string, customerId: string) {
    return this.prisma.wishlist.findMany({
      where: { tenantId, customerId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getWishlist(tenantId: string, customerId: string, wishlistId: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, tenantId, customerId },
      include: {
        items: {
          include: {
            productListing: {
              include: {
                category: true,
              },
            },
            variant: {
              include: {
                attributes: {
                  include: {
                    attributeType: true,
                    attributeValue: true,
                  },
                },
              },
            },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    return this.mapWishlistToResponse(wishlist);
  }

  async getOrCreateDefaultWishlist(tenantId: string, customerId: string) {
    let wishlist = await this.prisma.wishlist.findFirst({
      where: { tenantId, customerId, isDefault: true },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: {
          tenantId,
          customerId,
          name: 'My Wishlist',
          isDefault: true,
        },
      });
    }

    return wishlist;
  }

  async createWishlist(tenantId: string, customerId: string, dto: CreateWishlistDto) {
    // If this is set as default, unset other defaults
    if (!dto.name) {
      const existingDefault = await this.prisma.wishlist.findFirst({
        where: { tenantId, customerId, isDefault: true },
      });
      if (existingDefault) {
        throw new BadRequestException('Default wishlist already exists. Use a name for additional wishlists.');
      }
    }

    return this.prisma.wishlist.create({
      data: {
        tenantId,
        customerId,
        name: dto.name || 'My Wishlist',
        isPublic: dto.isPublic ?? false,
        shareToken: dto.isPublic ? crypto.randomBytes(16).toString('hex') : null,
        isDefault: !dto.name, // First unnamed wishlist is default
      },
    });
  }

  async updateWishlist(tenantId: string, customerId: string, wishlistId: string, dto: CreateWishlistDto) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, tenantId, customerId },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    return this.prisma.wishlist.update({
      where: { id: wishlistId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.isPublic !== undefined && {
          isPublic: dto.isPublic,
          shareToken: dto.isPublic ? (wishlist.shareToken || crypto.randomBytes(16).toString('hex')) : null,
        }),
      },
    });
  }

  async deleteWishlist(tenantId: string, customerId: string, wishlistId: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, tenantId, customerId },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    if (wishlist.isDefault) {
      throw new BadRequestException('Cannot delete default wishlist');
    }

    await this.prisma.wishlist.delete({ where: { id: wishlistId } });
    return { success: true };
  }

  // ============ WISHLIST ITEMS ============

  async addItem(tenantId: string, customerId: string, dto: AddWishlistItemDto) {
    // Get or create default wishlist
    const wishlist = await this.getOrCreateDefaultWishlist(tenantId, customerId);

    // Verify product exists
    const product = await this.prisma.productListing.findFirst({
      where: { id: dto.productListingId, tenantId, isPublished: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify variant if provided
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: dto.variantId, productListingId: dto.productListingId },
      });

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }
    }

    // Check if item already exists
    const existingItem = await this.prisma.wishlistItem.findFirst({
      where: {
        wishlistId: wishlist.id,
        productListingId: dto.productListingId,
        variantId: dto.variantId || null,
      },
    });

    if (existingItem) {
      // Update priority/notes if provided
      return this.prisma.wishlistItem.update({
        where: { id: existingItem.id },
        data: {
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: {
          productListing: true,
          variant: true,
        },
      });
    }

    // Get current price for tracking
    let currentPrice = product.price;
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (variant?.price) {
        currentPrice = variant.price;
      }
    }

    return this.prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productListingId: dto.productListingId,
        variantId: dto.variantId,
        priceWhenAdded: currentPrice,
        priority: dto.priority ?? 0,
        notes: dto.notes,
      },
      include: {
        productListing: true,
        variant: true,
      },
    });
  }

  async addItemToWishlist(
    tenantId: string,
    customerId: string,
    wishlistId: string,
    dto: AddWishlistItemDto
  ) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, tenantId, customerId },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    // Same logic as addItem but with specific wishlist
    const product = await this.prisma.productListing.findFirst({
      where: { id: dto.productListingId, tenantId, isPublished: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existingItem = await this.prisma.wishlistItem.findFirst({
      where: {
        wishlistId,
        productListingId: dto.productListingId,
        variantId: dto.variantId || null,
      },
    });

    if (existingItem) {
      throw new BadRequestException('Item already in wishlist');
    }

    let currentPrice = product.price;
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (variant?.price) {
        currentPrice = variant.price;
      }
    }

    return this.prisma.wishlistItem.create({
      data: {
        wishlistId,
        productListingId: dto.productListingId,
        variantId: dto.variantId,
        priceWhenAdded: currentPrice,
        priority: dto.priority ?? 0,
        notes: dto.notes,
      },
      include: {
        productListing: true,
        variant: true,
      },
    });
  }

  async removeItem(tenantId: string, customerId: string, itemId: string) {
    const item = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId },
      include: {
        wishlist: true,
      },
    });

    if (!item || item.wishlist.tenantId !== tenantId || item.wishlist.customerId !== customerId) {
      throw new NotFoundException('Item not found');
    }

    await this.prisma.wishlistItem.delete({ where: { id: itemId } });
    return { success: true };
  }

  async moveToCart(tenantId: string, customerId: string, itemId: string, cartId: string) {
    const item = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId },
      include: {
        wishlist: true,
        productListing: true,
        variant: true,
      },
    });

    if (!item || item.wishlist.tenantId !== tenantId || item.wishlist.customerId !== customerId) {
      throw new NotFoundException('Item not found');
    }

    // Get current price
    const price = item.variant?.price || item.productListing.price;

    // Add to cart
    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId_variantId: {
          cartId,
          productId: item.productListingId,
          variantId: item.variantId || '',
        },
      },
      create: {
        tenantId,
        cartId,
        productId: item.productListingId,
        variantId: item.variantId,
        quantity: 1,
        price,
      },
      update: {
        quantity: { increment: 1 },
      },
    });

    // Remove from wishlist
    await this.prisma.wishlistItem.delete({ where: { id: itemId } });

    return { success: true };
  }

  // ============ PUBLIC SHARED WISHLIST ============

  async getSharedWishlist(tenantId: string, shareToken: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { shareToken, isPublic: true, tenantId },
      include: {
        customer: {
          select: { firstName: true },
        },
        items: {
          include: {
            productListing: {
              include: {
                category: true,
              },
            },
            variant: {
              include: {
                attributes: {
                  include: {
                    attributeType: true,
                    attributeValue: true,
                  },
                },
              },
            },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    return this.mapWishlistToResponse(wishlist);
  }

  // ============ HELPERS ============

  private mapWishlistToResponse(wishlist: WishlistWithRelations) {
    return {
      id: wishlist.id,
      name: wishlist.name,
      isDefault: wishlist.isDefault,
      isPublic: wishlist.isPublic,
      shareToken: wishlist.shareToken,
      shareUrl: wishlist.shareToken ? `/wishlist/shared/${wishlist.shareToken}` : null,
      ownerName: wishlist.customer?.firstName || 'Someone',
      items: wishlist.items?.map((item) => ({
        id: item.id,
        product: {
          id: item.productListing.id,
          slug: item.productListing.slug,
          name: item.productListing.displayName,
          price: item.productListing.price,
          compareAtPrice: item.productListing.compareAtPrice,
          images: item.productListing.images,
          category: item.productListing.category?.name,
        },
        variant: item.variant
          ? {
              id: item.variant.id,
              sku: item.variant.sku,
              price: item.variant.price,
              imageUrl: item.variant.imageUrl,
              attributes: item.variant.attributes?.map((a) => ({
                type: a.attributeType.displayName,
                value: a.attributeValue.displayValue,
              })),
            }
          : null,
        priceWhenAdded: item.priceWhenAdded,
        priceDropped: item.priceWhenAdded
          ? Number(item.variant?.price || item.productListing.price) < Number(item.priceWhenAdded)
          : false,
        priority: item.priority,
        notes: item.notes,
        addedAt: item.createdAt,
      })),
      createdAt: wishlist.createdAt,
    };
  }
}
