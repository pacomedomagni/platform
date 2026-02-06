import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsInt,
  IsArray,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ThemeColors } from '../interfaces/theme-colors.interface';

/**
 * DTO for updating an existing theme
 * All fields are optional
 */
export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  colors?: Partial<ThemeColors>;

  // Typography
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  headingFont?: string;

  @IsOptional()
  @IsString()
  fontSize?: 'sm' | 'base' | 'lg';

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(900)
  fontWeightBody?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(900)
  fontWeightHeading?: number;

  // Layout Settings
  @IsOptional()
  @IsString()
  layoutStyle?: 'standard' | 'wide' | 'boxed';

  @IsOptional()
  @IsString()
  headerStyle?: 'classic' | 'minimal' | 'centered';

  @IsOptional()
  @IsString()
  footerStyle?: 'standard' | 'minimal';

  @IsOptional()
  @IsString()
  spacing?: 'compact' | 'comfortable' | 'spacious';

  @IsOptional()
  @IsString()
  containerMaxWidth?: string;

  // Component Styles
  @IsOptional()
  @IsString()
  buttonStyle?: 'rounded' | 'square' | 'pill';

  @IsOptional()
  @IsString()
  buttonSize?: 'sm' | 'md' | 'lg';

  @IsOptional()
  @IsString()
  cardStyle?: 'shadow' | 'border' | 'flat';

  @IsOptional()
  @IsString()
  cardRadius?: 'none' | 'sm' | 'md' | 'lg';

  @IsOptional()
  @IsString()
  inputStyle?: 'outlined' | 'filled';

  // Product Display
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  productGridColumns?: number;

  @IsOptional()
  @IsString()
  productImageRatio?: 'square' | 'portrait' | 'landscape';

  @IsOptional()
  @IsBoolean()
  showQuickView?: boolean;

  @IsOptional()
  @IsBoolean()
  showWishlist?: boolean;

  // Advanced
  @IsOptional()
  @IsString()
  customCSS?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  // Metadata
  @IsOptional()
  @IsString()
  previewImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
