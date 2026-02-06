import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';

interface TenantContext {
  tenantId: string;
  storeId: string;
}

// ==========================================
// I18n Service - Internationalization Support
// ==========================================

@Injectable()
export class I18nService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Language Management
  // ==========================================

  /**
   * List all languages for a store
   */
  async listLanguages(ctx: TenantContext, includeDisabled = false) {
    return this.prisma.storeLanguage.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(includeDisabled ? {} : { isEnabled: true }),
      },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get a specific language
   */
  async getLanguage(ctx: TenantContext, languageCode: string) {
    const language = await this.prisma.storeLanguage.findFirst({
      where: {
        tenantId: ctx.tenantId,
        languageCode,
      },
    });

    if (!language) {
      throw new NotFoundException(`Language '${languageCode}' not found`);
    }

    return language;
  }

  /**
   * Get the default language for a store
   */
  async getDefaultLanguage(ctx: TenantContext) {
    const language = await this.prisma.storeLanguage.findFirst({
      where: {
        tenantId: ctx.tenantId,
        isDefault: true,
      },
    });

    if (!language) {
      // Fall back to first enabled language
      return this.prisma.storeLanguage.findFirst({
        where: {
          tenantId: ctx.tenantId,
          isEnabled: true,
        },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return language;
  }

  /**
   * Create a new language for the store
   */
  async createLanguage(
    ctx: TenantContext,
    data: {
      languageCode: string;
      countryCode?: string;
      name: string;
      nativeName?: string;
      isDefault?: boolean;
      isEnabled?: boolean;
      sortOrder?: number;
    }
  ) {
    // If this is the default, unset other defaults
    if (data.isDefault) {
      await this.prisma.storeLanguage.updateMany({
        where: { tenantId: ctx.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if first language - make it default
    const existingCount = await this.prisma.storeLanguage.count({
      where: { tenantId: ctx.tenantId },
    });

    return this.prisma.storeLanguage.create({
      data: {
        tenantId: ctx.tenantId,
        languageCode: data.languageCode.toLowerCase(),
        countryCode: data.countryCode?.toUpperCase(),
        name: data.name,
        nativeName: data.nativeName ?? data.name,
        isDefault: data.isDefault ?? existingCount === 0,
        isEnabled: data.isEnabled ?? true,
        sortOrder: data.sortOrder ?? existingCount,
      },
    });
  }

  /**
   * Update a language
   */
  async updateLanguage(
    ctx: TenantContext,
    languageCode: string,
    data: {
      name?: string;
      nativeName?: string;
      isDefault?: boolean;
      isEnabled?: boolean;
      sortOrder?: number;
    }
  ) {
    // Ensure language exists
    const lang = await this.getLanguage(ctx, languageCode);

    // If setting as default, unset others
    if (data.isDefault) {
      await this.prisma.storeLanguage.updateMany({
        where: {
          tenantId: ctx.tenantId,
          isDefault: true,
          languageCode: { not: languageCode },
        },
        data: { isDefault: false },
      });
    }

    // Can't disable default language
    if (data.isEnabled === false && lang.isDefault) {
      throw new BadRequestException('Cannot disable the default language');
    }

    return this.prisma.storeLanguage.update({
      where: { id: lang.id },
      data,
    });
  }

  /**
   * Delete a language
   */
  async deleteLanguage(ctx: TenantContext, languageCode: string) {
    const language = await this.getLanguage(ctx, languageCode);

    if (language.isDefault) {
      throw new BadRequestException('Cannot delete the default language');
    }

    // Delete all translations for this language
    await this.prisma.$transaction([
      this.prisma.productTranslation.deleteMany({
        where: { tenantId: ctx.tenantId, languageCode },
      }),
      this.prisma.categoryTranslation.deleteMany({
        where: { tenantId: ctx.tenantId, languageCode },
      }),
      this.prisma.attributeTranslation.deleteMany({
        where: { tenantId: ctx.tenantId, languageCode },
      }),
      this.prisma.shippingRateTranslation.deleteMany({
        where: { tenantId: ctx.tenantId, languageCode },
      }),
      this.prisma.contentTranslation.deleteMany({
        where: { tenantId: ctx.tenantId, languageCode },
      }),
      this.prisma.storeLanguage.delete({
        where: { id: language.id },
      }),
    ]);

    return { deleted: true };
  }

  // ==========================================
  // Product Translations
  // ==========================================

  /**
   * Get all translations for a product
   */
  async getProductTranslations(ctx: TenantContext, productListingId: string) {
    return this.prisma.productTranslation.findMany({
      where: {
        tenantId: ctx.tenantId,
        productListingId,
      },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Get a specific product translation
   */
  async getProductTranslation(
    ctx: TenantContext,
    productListingId: string,
    languageCode: string
  ) {
    const translation = await this.prisma.productTranslation.findUnique({
      where: {
        productListingId_languageCode: {
          productListingId,
          languageCode,
        },
      },
    });

    if (!translation || translation.tenantId !== ctx.tenantId) {
      throw new NotFoundException(
        `Translation for product '${productListingId}' in '${languageCode}' not found`
      );
    }

    return translation;
  }

  /**
   * Create or update a product translation
   */
  async upsertProductTranslation(
    ctx: TenantContext,
    data: {
      productListingId: string;
      languageCode: string;
      displayName: string;
      shortDescription?: string;
      longDescription?: string;
      metaTitle?: string;
      metaDescription?: string;
      slug?: string;
      badge?: string;
    }
  ) {
    // Validate language exists
    await this.getLanguage(ctx, data.languageCode);

    return this.prisma.productTranslation.upsert({
      where: {
        productListingId_languageCode: {
          productListingId: data.productListingId,
          languageCode: data.languageCode,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        productListingId: data.productListingId,
        languageCode: data.languageCode,
        displayName: data.displayName,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        slug: data.slug,
        badge: data.badge,
      },
      update: {
        displayName: data.displayName,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        slug: data.slug,
        badge: data.badge,
      },
    });
  }

  /**
   * Bulk upsert translations for a product
   */
  async bulkUpsertProductTranslations(
    ctx: TenantContext,
    productListingId: string,
    translations: Array<{
      languageCode: string;
      displayName: string;
      shortDescription?: string;
      longDescription?: string;
      metaTitle?: string;
      metaDescription?: string;
      slug?: string;
      badge?: string;
    }>
  ) {
    const results = await Promise.all(
      translations.map((t) =>
        this.upsertProductTranslation(ctx, { ...t, productListingId })
      )
    );
    return results;
  }

  /**
   * Delete a product translation
   */
  async deleteProductTranslation(
    ctx: TenantContext,
    productListingId: string,
    languageCode: string
  ) {
    await this.getProductTranslation(ctx, productListingId, languageCode);

    await this.prisma.productTranslation.delete({
      where: {
        productListingId_languageCode: {
          productListingId,
          languageCode,
        },
      },
    });

    return { deleted: true };
  }

  /**
   * Get a product with translations applied
   */
  async getLocalizedProduct(
    ctx: TenantContext,
    productListingId: string,
    languageCode: string
  ) {
    const product = await this.prisma.productListing.findUnique({
      where: { id: productListingId },
      include: {
        category: true,
        item: true,
      },
    });

    if (!product || product.tenantId !== ctx.tenantId) {
      throw new NotFoundException(`Product '${productListingId}' not found`);
    }

    // Try to get translation
    const translation = await this.prisma.productTranslation.findUnique({
      where: {
        productListingId_languageCode: {
          productListingId,
          languageCode,
        },
      },
    });

    // Merge translation over product
    if (translation) {
      return {
        ...product,
        displayName: translation.displayName,
        shortDescription: translation.shortDescription ?? product.shortDescription,
        longDescription: translation.longDescription ?? product.longDescription,
        metaTitle: translation.metaTitle ?? product.metaTitle,
        metaDescription: translation.metaDescription ?? product.metaDescription,
        badge: translation.badge ?? product.badge,
        _translation: {
          languageCode: translation.languageCode,
          translatedAt: translation.updatedAt,
        },
      };
    }

    return {
      ...product,
      _translation: null, // No translation available
    };
  }

  // ==========================================
  // Category Translations
  // ==========================================

  /**
   * Get all translations for a category
   */
  async getCategoryTranslations(ctx: TenantContext, categoryId: string) {
    return this.prisma.categoryTranslation.findMany({
      where: {
        tenantId: ctx.tenantId,
        categoryId,
      },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update a category translation
   */
  async upsertCategoryTranslation(
    ctx: TenantContext,
    data: {
      categoryId: string;
      languageCode: string;
      name: string;
      description?: string;
      slug?: string;
      metaTitle?: string;
      metaDescription?: string;
    }
  ) {
    // Validate language exists
    await this.getLanguage(ctx, data.languageCode);

    return this.prisma.categoryTranslation.upsert({
      where: {
        categoryId_languageCode: {
          categoryId: data.categoryId,
          languageCode: data.languageCode,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        categoryId: data.categoryId,
        languageCode: data.languageCode,
        name: data.name,
        description: data.description,
        slug: data.slug,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
      },
      update: {
        name: data.name,
        description: data.description,
        slug: data.slug,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
      },
    });
  }

  /**
   * Delete a category translation
   */
  async deleteCategoryTranslation(
    ctx: TenantContext,
    categoryId: string,
    languageCode: string
  ) {
    await this.prisma.categoryTranslation.delete({
      where: {
        categoryId_languageCode: {
          categoryId,
          languageCode,
        },
      },
    });

    return { deleted: true };
  }

  /**
   * Get a category with translations applied
   */
  async getLocalizedCategory(
    ctx: TenantContext,
    categoryId: string,
    languageCode: string
  ) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id: categoryId },
      include: {
        children: true,
        parent: true,
      },
    });

    if (!category || category.tenantId !== ctx.tenantId) {
      throw new NotFoundException(`Category '${categoryId}' not found`);
    }

    const translation = await this.prisma.categoryTranslation.findUnique({
      where: {
        categoryId_languageCode: {
          categoryId,
          languageCode,
        },
      },
    });

    if (translation) {
      return {
        ...category,
        name: translation.name,
        description: translation.description ?? category.description,
        slug: translation.slug ?? category.slug,
        _translation: {
          languageCode: translation.languageCode,
          translatedAt: translation.updatedAt,
        },
      };
    }

    return {
      ...category,
      _translation: null,
    };
  }

  // ==========================================
  // Content Translations (Static content, UI strings, etc.)
  // ==========================================

  /**
   * List all content translations for a language
   */
  async listContentTranslations(ctx: TenantContext, languageCode: string) {
    return this.prisma.contentTranslation.findMany({
      where: {
        tenantId: ctx.tenantId,
        languageCode,
      },
      orderBy: { contentKey: 'asc' },
    });
  }

  /**
   * Get a content translation by key
   */
  async getContentTranslation(
    ctx: TenantContext,
    contentKey: string,
    languageCode: string
  ) {
    return this.prisma.contentTranslation.findUnique({
      where: {
        tenantId_contentKey_languageCode: {
          tenantId: ctx.tenantId,
          contentKey,
          languageCode,
        },
      },
    });
  }

  /**
   * Get content in a specific language with fallback to default
   */
  async getContent(
    ctx: TenantContext,
    contentKey: string,
    languageCode: string
  ): Promise<string | null> {
    // Try requested language
    const translation = await this.getContentTranslation(ctx, contentKey, languageCode);
    if (translation) {
      return translation.content;
    }

    // Fall back to default language
    const defaultLang = await this.getDefaultLanguage(ctx);
    if (defaultLang && defaultLang.languageCode !== languageCode) {
      const defaultTranslation = await this.getContentTranslation(
        ctx,
        contentKey,
        defaultLang.languageCode
      );
      if (defaultTranslation) {
        return defaultTranslation.content;
      }
    }

    return null;
  }

  /**
   * Get multiple content translations at once
   */
  async getContents(
    ctx: TenantContext,
    contentKeys: string[],
    languageCode: string
  ): Promise<Record<string, string>> {
    const translations = await this.prisma.contentTranslation.findMany({
      where: {
        tenantId: ctx.tenantId,
        contentKey: { in: contentKeys },
        languageCode,
      },
    });

    const result: Record<string, string> = {};
    translations.forEach((t) => {
      result[t.contentKey] = t.content;
    });

    // Fill missing keys from default language
    const missingKeys = contentKeys.filter((k) => !result[k]);
    if (missingKeys.length > 0) {
      const defaultLang = await this.getDefaultLanguage(ctx);
      if (defaultLang && defaultLang.languageCode !== languageCode) {
        const defaultTranslations = await this.prisma.contentTranslation.findMany({
          where: {
            tenantId: ctx.tenantId,
            contentKey: { in: missingKeys },
            languageCode: defaultLang.languageCode,
          },
        });
        defaultTranslations.forEach((t) => {
          result[t.contentKey] = t.content;
        });
      }
    }

    return result;
  }

  /**
   * Create or update content translation
   */
  async upsertContentTranslation(
    ctx: TenantContext,
    data: {
      contentKey: string;
      languageCode: string;
      content: string;
      contentType?: 'text' | 'html' | 'markdown';
    }
  ) {
    // Validate language exists
    await this.getLanguage(ctx, data.languageCode);

    return this.prisma.contentTranslation.upsert({
      where: {
        tenantId_contentKey_languageCode: {
          tenantId: ctx.tenantId,
          contentKey: data.contentKey,
          languageCode: data.languageCode,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        contentKey: data.contentKey,
        languageCode: data.languageCode,
        content: data.content,
        contentType: data.contentType ?? 'text',
      },
      update: {
        content: data.content,
        contentType: data.contentType,
      },
    });
  }

  /**
   * Bulk upsert content translations
   */
  async bulkUpsertContentTranslations(
    ctx: TenantContext,
    contentKey: string,
    translations: Array<{
      languageCode: string;
      content: string;
      contentType?: 'text' | 'html' | 'markdown';
    }>
  ) {
    const results = await Promise.all(
      translations.map((t) =>
        this.upsertContentTranslation(ctx, { ...t, contentKey })
      )
    );
    return results;
  }

  /**
   * Delete a content translation
   */
  async deleteContentTranslation(
    ctx: TenantContext,
    contentKey: string,
    languageCode: string
  ) {
    await this.prisma.contentTranslation.delete({
      where: {
        tenantId_contentKey_languageCode: {
          tenantId: ctx.tenantId,
          contentKey,
          languageCode,
        },
      },
    });

    return { deleted: true };
  }

  // ==========================================
  // Translation Statistics
  // ==========================================

  /**
   * Get translation coverage statistics for a store
   */
  async getTranslationStats(ctx: TenantContext) {
    const languages = await this.listLanguages(ctx, true);

    // Count translatable items
    const [productCount, categoryCount] = await Promise.all([
      this.prisma.productListing.count({ where: { tenantId: ctx.tenantId } }),
      this.prisma.productCategory.count({ where: { tenantId: ctx.tenantId } }),
    ]);

    // Count translations per language
    const stats = await Promise.all(
      languages.map(async (lang) => {
        const [products, categories, content] = await Promise.all([
          this.prisma.productTranslation.count({
            where: { tenantId: ctx.tenantId, languageCode: lang.languageCode },
          }),
          this.prisma.categoryTranslation.count({
            where: { tenantId: ctx.tenantId, languageCode: lang.languageCode },
          }),
          this.prisma.contentTranslation.count({
            where: { tenantId: ctx.tenantId, languageCode: lang.languageCode },
          }),
        ]);

        return {
          language: lang,
          products: {
            translated: products,
            total: productCount,
            percentage: productCount > 0 ? Math.round((products / productCount) * 100) : 100,
          },
          categories: {
            translated: categories,
            total: categoryCount,
            percentage: categoryCount > 0 ? Math.round((categories / categoryCount) * 100) : 100,
          },
          contentStrings: content,
        };
      })
    );

    return {
      languages: languages.length,
      enabledLanguages: languages.filter((l) => l.isEnabled).length,
      translationCoverage: stats,
    };
  }
}
