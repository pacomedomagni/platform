import { IsString, IsOptional, IsBoolean, IsInt, Min, IsArray, IsEnum } from 'class-validator';

// ==========================================
// Language DTOs
// ==========================================

export class CreateLanguageDto {
  @IsString()
  languageCode!: string; // ISO 639-1

  @IsString()
  @IsOptional()
  countryCode?: string; // ISO 3166-1

  @IsString()
  name!: string; // "English"

  @IsString()
  @IsOptional()
  nativeName?: string; // "English"

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateLanguageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  nativeName?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

// ==========================================
// Product Translation DTOs
// ==========================================

export class CreateProductTranslationDto {
  @IsString()
  productListingId!: string;

  @IsString()
  languageCode!: string;

  @IsString()
  displayName!: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  longDescription?: string;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  badge?: string;
}

export class UpdateProductTranslationDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  longDescription?: string;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  badge?: string;
}

// ==========================================
// Category Translation DTOs
// ==========================================

export class CreateCategoryTranslationDto {
  @IsString()
  categoryId!: string;

  @IsString()
  languageCode!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;
}

export class UpdateCategoryTranslationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;
}

// ==========================================
// Content Translation DTOs
// ==========================================

export class CreateContentTranslationDto {
  @IsString()
  contentKey!: string;

  @IsString()
  languageCode!: string;

  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  @IsEnum(['text', 'html', 'markdown'])
  contentType?: 'text' | 'html' | 'markdown';
}

export class UpdateContentTranslationDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['text', 'html', 'markdown'])
  contentType?: 'text' | 'html' | 'markdown';
}

// ==========================================
// Bulk Translation DTOs
// ==========================================

export class BulkProductTranslationDto {
  @IsString()
  productListingId!: string;

  @IsArray()
  translations!: Array<{
    languageCode: string;
    displayName: string;
    shortDescription?: string;
    longDescription?: string;
    metaTitle?: string;
    metaDescription?: string;
    slug?: string;
    badge?: string;
  }>;
}

export class BulkContentTranslationDto {
  @IsString()
  contentKey!: string;

  @IsArray()
  translations!: Array<{
    languageCode: string;
    content: string;
    contentType?: 'text' | 'html' | 'markdown';
  }>;
}
