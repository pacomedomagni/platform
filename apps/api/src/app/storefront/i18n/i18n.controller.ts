import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { I18nService } from './i18n.service';
import { StoreAdminGuard } from '@platform/auth';
import {
  CreateLanguageDto,
  UpdateLanguageDto,
  CreateProductTranslationDto,
  UpdateProductTranslationDto,
  CreateCategoryTranslationDto,
  UpdateCategoryTranslationDto,
  CreateContentTranslationDto,
  UpdateContentTranslationDto,
  BulkProductTranslationDto,
  BulkContentTranslationDto,
} from './i18n.dto';

// ==========================================
// Admin I18n Controller - Translation Management
// ==========================================

@Controller('storefront/:storeId/admin/i18n')
@UseGuards(StoreAdminGuard)
export class I18nAdminController {
  constructor(private readonly i18nService: I18nService) {}

  private getContext(storeId: string) {
    return { tenantId: storeId, storeId };
  }

  // ==========================================
  // Language Management
  // ==========================================

  @Get('languages')
  async listLanguages(
    @Param('storeId') storeId: string,
    @Query('includeDisabled') includeDisabled?: string
  ) {
    return this.i18nService.listLanguages(
      this.getContext(storeId),
      includeDisabled === 'true'
    );
  }

  @Get('languages/:languageCode')
  async getLanguage(
    @Param('storeId') storeId: string,
    @Param('languageCode') languageCode: string
  ) {
    return this.i18nService.getLanguage(this.getContext(storeId), languageCode);
  }

  @Post('languages')
  async createLanguage(
    @Param('storeId') storeId: string,
    @Body() dto: CreateLanguageDto
  ) {
    return this.i18nService.createLanguage(this.getContext(storeId), dto);
  }

  @Put('languages/:languageCode')
  async updateLanguage(
    @Param('storeId') storeId: string,
    @Param('languageCode') languageCode: string,
    @Body() dto: UpdateLanguageDto
  ) {
    return this.i18nService.updateLanguage(
      this.getContext(storeId),
      languageCode,
      dto
    );
  }

  @Delete('languages/:languageCode')
  async deleteLanguage(
    @Param('storeId') storeId: string,
    @Param('languageCode') languageCode: string
  ) {
    return this.i18nService.deleteLanguage(this.getContext(storeId), languageCode);
  }

  // ==========================================
  // Product Translations
  // ==========================================

  @Get('products/:productId/translations')
  async getProductTranslations(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string
  ) {
    return this.i18nService.getProductTranslations(
      this.getContext(storeId),
      productId
    );
  }

  @Get('products/:productId/translations/:languageCode')
  async getProductTranslation(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('languageCode') languageCode: string
  ) {
    return this.i18nService.getProductTranslation(
      this.getContext(storeId),
      productId,
      languageCode
    );
  }

  @Put('products/:productId/translations/:languageCode')
  async upsertProductTranslation(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('languageCode') languageCode: string,
    @Body() dto: UpdateProductTranslationDto
  ) {
    return this.i18nService.upsertProductTranslation(this.getContext(storeId), {
      productListingId: productId,
      languageCode,
      displayName: dto.displayName ?? '',
      ...dto,
    });
  }

  @Post('products/:productId/translations')
  async bulkUpsertProductTranslations(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: BulkProductTranslationDto
  ) {
    return this.i18nService.bulkUpsertProductTranslations(
      this.getContext(storeId),
      productId,
      dto.translations
    );
  }

  @Delete('products/:productId/translations/:languageCode')
  async deleteProductTranslation(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Param('languageCode') languageCode: string
  ) {
    return this.i18nService.deleteProductTranslation(
      this.getContext(storeId),
      productId,
      languageCode
    );
  }

  // ==========================================
  // Category Translations
  // ==========================================

  @Get('categories/:categoryId/translations')
  async getCategoryTranslations(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string
  ) {
    return this.i18nService.getCategoryTranslations(
      this.getContext(storeId),
      categoryId
    );
  }

  @Put('categories/:categoryId/translations/:languageCode')
  async upsertCategoryTranslation(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
    @Param('languageCode') languageCode: string,
    @Body() dto: UpdateCategoryTranslationDto
  ) {
    return this.i18nService.upsertCategoryTranslation(this.getContext(storeId), {
      categoryId,
      languageCode,
      name: dto.name ?? '',
      ...dto,
    });
  }

  @Delete('categories/:categoryId/translations/:languageCode')
  async deleteCategoryTranslation(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
    @Param('languageCode') languageCode: string
  ) {
    return this.i18nService.deleteCategoryTranslation(
      this.getContext(storeId),
      categoryId,
      languageCode
    );
  }

  // ==========================================
  // Content Translations
  // ==========================================

  @Get('content')
  async listContentTranslations(
    @Param('storeId') storeId: string,
    @Query('languageCode') languageCode: string
  ) {
    return this.i18nService.listContentTranslations(
      this.getContext(storeId),
      languageCode
    );
  }

  @Get('content/:contentKey')
  async getContentTranslation(
    @Param('storeId') storeId: string,
    @Param('contentKey') contentKey: string,
    @Query('languageCode') languageCode: string
  ) {
    return this.i18nService.getContentTranslation(
      this.getContext(storeId),
      contentKey,
      languageCode
    );
  }

  @Put('content/:contentKey/:languageCode')
  async upsertContentTranslation(
    @Param('storeId') storeId: string,
    @Param('contentKey') contentKey: string,
    @Param('languageCode') languageCode: string,
    @Body() dto: UpdateContentTranslationDto
  ) {
    return this.i18nService.upsertContentTranslation(this.getContext(storeId), {
      contentKey,
      languageCode,
      content: dto.content ?? '',
      contentType: dto.contentType,
    });
  }

  @Post('content/:contentKey/translations')
  async bulkUpsertContentTranslations(
    @Param('storeId') storeId: string,
    @Param('contentKey') contentKey: string,
    @Body() dto: BulkContentTranslationDto
  ) {
    return this.i18nService.bulkUpsertContentTranslations(
      this.getContext(storeId),
      contentKey,
      dto.translations
    );
  }

  @Delete('content/:contentKey/:languageCode')
  async deleteContentTranslation(
    @Param('storeId') storeId: string,
    @Param('contentKey') contentKey: string,
    @Param('languageCode') languageCode: string
  ) {
    return this.i18nService.deleteContentTranslation(
      this.getContext(storeId),
      contentKey,
      languageCode
    );
  }

  // ==========================================
  // Statistics
  // ==========================================

  @Get('stats')
  async getTranslationStats(@Param('storeId') storeId: string) {
    return this.i18nService.getTranslationStats(this.getContext(storeId));
  }
}

// ==========================================
// Public I18n Controller - For Storefront
// ==========================================

@Controller('storefront/:storeId/i18n')
export class I18nPublicController {
  constructor(private readonly i18nService: I18nService) {}

  private getContext(storeId: string) {
    return { tenantId: storeId, storeId };
  }

  /**
   * Get available languages for the storefront
   */
  @Get('languages')
  async listLanguages(@Param('storeId') storeId: string) {
    return this.i18nService.listLanguages(this.getContext(storeId), false);
  }

  /**
   * Get the default language
   */
  @Get('languages/default')
  async getDefaultLanguage(@Param('storeId') storeId: string) {
    return this.i18nService.getDefaultLanguage(this.getContext(storeId));
  }

  /**
   * Get a product with translations applied
   */
  @Get('products/:productId')
  async getLocalizedProduct(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Query('lang') lang?: string
  ) {
    const defaultLang = await this.i18nService.getDefaultLanguage(
      this.getContext(storeId)
    );
    const languageCode = lang ?? defaultLang?.languageCode ?? 'en';

    return this.i18nService.getLocalizedProduct(
      this.getContext(storeId),
      productId,
      languageCode
    );
  }

  /**
   * Get a category with translations applied
   */
  @Get('categories/:categoryId')
  async getLocalizedCategory(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
    @Query('lang') lang?: string
  ) {
    const defaultLang = await this.i18nService.getDefaultLanguage(
      this.getContext(storeId)
    );
    const languageCode = lang ?? defaultLang?.languageCode ?? 'en';

    return this.i18nService.getLocalizedCategory(
      this.getContext(storeId),
      categoryId,
      languageCode
    );
  }

  /**
   * Get content translations
   */
  @Get('content')
  async getContents(
    @Param('storeId') storeId: string,
    @Query('keys') keys: string,
    @Query('lang') lang?: string
  ) {
    const defaultLang = await this.i18nService.getDefaultLanguage(
      this.getContext(storeId)
    );
    const languageCode = lang ?? defaultLang?.languageCode ?? 'en';
    const contentKeys = keys.split(',').map((k) => k.trim());

    return this.i18nService.getContents(
      this.getContext(storeId),
      contentKeys,
      languageCode
    );
  }

  /**
   * Get a single content translation
   */
  @Get('content/:contentKey')
  async getContent(
    @Param('storeId') storeId: string,
    @Param('contentKey') contentKey: string,
    @Query('lang') lang?: string
  ) {
    const defaultLang = await this.i18nService.getDefaultLanguage(
      this.getContext(storeId)
    );
    const languageCode = lang ?? defaultLang?.languageCode ?? 'en';

    const content = await this.i18nService.getContent(
      this.getContext(storeId),
      contentKey,
      languageCode
    );

    return { key: contentKey, languageCode, content };
  }
}
