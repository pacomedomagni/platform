import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProductSEO(
    tenantId: string,
    productId: string,
    data: { metaTitle?: string; metaDescription?: string },
  ) {
    const product = await this.prisma.productListing.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productListing.update({
      where: { id: productId },
      data: {
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        metaTitle: true,
        metaDescription: true,
      },
    });
  }

  async updatePageSEO(
    tenantId: string,
    pageId: string,
    data: {
      metaTitle?: string;
      metaDescription?: string;
      ogImage?: string;
      structuredData?: Record<string, unknown>;
    },
  ) {
    const page = await this.prisma.storePage.findFirst({
      where: { id: pageId, tenantId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.prisma.storePage.update({
      where: { id: pageId },
      data: {
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(data.ogImage !== undefined && { ogImage: data.ogImage }),
        ...(data.structuredData !== undefined && { structuredData: data.structuredData as Prisma.InputJsonValue }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
        structuredData: true,
      },
    });
  }

  async generateSitemap(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { domain: true, customDomain: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const baseUrl = tenant.customDomain
      ? `https://${tenant.customDomain}`
      : tenant.domain
        ? `https://${tenant.domain}`
        : 'https://store.example.com';

    const [products, pages] = await Promise.all([
      this.prisma.productListing.findMany({
        where: { tenantId, isPublished: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.storePage.findMany({
        where: { tenantId, isPublished: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    // Product pages
    for (const product of products) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/products/${product.slug}</loc>\n`;
      xml += `    <lastmod>${product.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    // Store pages
    for (const page of pages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/pages/${page.slug}</loc>\n`;
      xml += `    <lastmod>${page.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    return xml;
  }

  async generateStructuredData(tenantId: string, productId: string) {
    const product = await this.prisma.productListing.findFirst({
      where: { id: productId, tenantId, isPublished: true },
      include: {
        item: {
          select: { code: true },
        },
        category: {
          select: { name: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessName: true, name: true, domain: true, customDomain: true },
    });

    const baseUrl = tenant?.customDomain
      ? `https://${tenant.customDomain}`
      : tenant?.domain
        ? `https://${tenant.domain}`
        : 'https://store.example.com';

    const structuredData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.displayName,
      description: product.shortDescription || product.metaDescription || '',
      sku: product.item.code,
      image: product.images.length > 0 ? product.images : undefined,
      url: `${baseUrl}/products/${product.slug}`,
      category: product.category?.name,
      brand: {
        '@type': 'Brand',
        name: tenant?.businessName || tenant?.name || '',
      },
      offers: {
        '@type': 'Offer',
        price: Number(product.price).toFixed(2),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${baseUrl}/products/${product.slug}`,
        ...(product.compareAtPrice && {
          priceValidUntil: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1),
          )
            .toISOString()
            .split('T')[0],
        }),
      },
    };

    // Add aggregate rating if reviews exist
    if (product.reviewCount > 0 && product.averageRating) {
      structuredData.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Number(product.averageRating).toFixed(1),
        reviewCount: product.reviewCount,
      };
    }

    return structuredData;
  }

  async getSEOAudit(tenantId: string) {
    const [products, pages] = await Promise.all([
      this.prisma.productListing.findMany({
        where: { tenantId, isPublished: true },
        select: {
          id: true,
          slug: true,
          displayName: true,
          metaTitle: true,
          metaDescription: true,
        },
      }),
      this.prisma.storePage.findMany({
        where: { tenantId, isPublished: true },
        select: {
          id: true,
          slug: true,
          title: true,
          metaTitle: true,
          metaDescription: true,
          ogImage: true,
          structuredData: true,
        },
      }),
    ]);

    const productsWithoutMeta = products.filter(
      (p) => !p.metaTitle || !p.metaDescription,
    );

    const pagesWithoutMeta = pages.filter(
      (p) => !p.metaTitle || !p.metaDescription,
    );

    const totalProducts = products.length;
    const totalPages = pages.length;
    const totalItems = totalProducts + totalPages;

    // Score: percentage of items with complete SEO metadata
    const productsWithMeta = totalProducts - productsWithoutMeta.length;
    const pagesWithMeta = totalPages - pagesWithoutMeta.length;
    const score = totalItems > 0
      ? Math.round(((productsWithMeta + pagesWithMeta) / totalItems) * 100)
      : 100;

    return {
      productsWithoutMeta: productsWithoutMeta.map((p) => ({
        id: p.id,
        slug: p.slug,
        displayName: p.displayName,
        missingMetaTitle: !p.metaTitle,
        missingMetaDescription: !p.metaDescription,
      })),
      pagesWithoutMeta: pagesWithoutMeta.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        missingMetaTitle: !p.metaTitle,
        missingMetaDescription: !p.metaDescription,
        missingOgImage: !p.ogImage,
        missingStructuredData: !p.structuredData,
      })),
      totalProducts,
      totalPages,
      score,
    };
  }
}
