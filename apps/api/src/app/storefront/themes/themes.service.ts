/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { CreateThemeDto, UpdateThemeDto } from './dto';
import { validateThemeColors } from './interfaces/theme-colors.interface';
import { getAllPresets, getPresetBySlug } from './presets';

@Injectable()
export class ThemesService implements OnModuleInit {
  private readonly logger = new Logger(ThemesService.name);
  private activeThemeCache = new Map<string, any>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed preset themes on module initialization
   */
  async onModuleInit() {
    await this.seedPresets();
  }

  /**
   * Get all themes for a tenant
   */
  async getThemes(tenantId: string) {
    const themes = await this.prisma.storeTheme.findMany({
      where: { tenantId },
      orderBy: [{ isPreset: 'desc' }, { isActive: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        isCustom: true,
        isPreset: true,
        colors: true,
        previewImageUrl: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return themes;
  }

  /**
   * Get the currently active theme for a tenant
   */
  async getActiveTheme(tenantId: string) {
    // Check cache first
    const cached = this.activeThemeCache.get(tenantId);
    if (cached) {
      return cached;
    }

    const activeTheme = await this.prisma.storeTheme.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
    });

    if (!activeTheme) {
      // Return default modern theme if no active theme
      const modernPreset = getPresetBySlug('modern');
      return {
        ...modernPreset,
        id: 'default',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Cache the active theme
    this.activeThemeCache.set(tenantId, activeTheme);

    return activeTheme;
  }

  /**
   * Get a specific theme by ID
   */
  async getThemeById(id: string, tenantId: string) {
    const theme = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    return theme;
  }

  /**
   * Get all preset themes (not tenant-specific)
   */
  async getPresets() {
    return getAllPresets();
  }

  /**
   * Create a new custom theme
   */
  async createTheme(tenantId: string, dto: CreateThemeDto) {
    // Validate colors
    if (!validateThemeColors(dto.colors)) {
      throw new BadRequestException('Invalid color format. Colors must be valid hex codes.');
    }

    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check slug uniqueness
    const existingSlug = await this.prisma.storeTheme.findFirst({
      where: { tenantId, slug },
    });

    if (existingSlug) {
      throw new ConflictException('Theme with this slug already exists');
    }

    const theme = await this.prisma.storeTheme.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description,
        isCustom: true,
        isPreset: false,
        isActive: false,
        colors: dto.colors as any,
        fontFamily: dto.fontFamily || 'Inter',
        headingFont: dto.headingFont,
        fontSize: dto.fontSize || 'base',
        fontWeightBody: dto.fontWeightBody || 400,
        fontWeightHeading: dto.fontWeightHeading || 700,
        layoutStyle: dto.layoutStyle || 'standard',
        headerStyle: dto.headerStyle || 'classic',
        footerStyle: dto.footerStyle || 'standard',
        spacing: dto.spacing || 'comfortable',
        containerMaxWidth: dto.containerMaxWidth || '1280px',
        buttonStyle: dto.buttonStyle || 'rounded',
        buttonSize: dto.buttonSize || 'md',
        cardStyle: dto.cardStyle || 'shadow',
        cardRadius: dto.cardRadius || 'lg',
        inputStyle: dto.inputStyle || 'outlined',
        productGridColumns: dto.productGridColumns || 3,
        productImageRatio: dto.productImageRatio || 'square',
        showQuickView: dto.showQuickView ?? true,
        showWishlist: dto.showWishlist ?? true,
        customCSS: dto.customCSS ? this.sanitizeCss(dto.customCSS) : null,
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        previewImageUrl: dto.previewImageUrl,
        tags: dto.tags || [],
      },
    });

    return theme;
  }

  /**
   * Update an existing theme
   */
  async updateTheme(id: string, tenantId: string, dto: UpdateThemeDto) {
    const existing = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Theme not found');
    }

    // Prevent editing preset themes
    if (existing.isPreset) {
      throw new BadRequestException(
        'Cannot edit preset themes. Please duplicate the theme first.'
      );
    }

    // Validate colors if provided
    if (dto.colors && !validateThemeColors(dto.colors)) {
      throw new BadRequestException('Invalid color format. Colors must be valid hex codes.');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const existingSlug = await this.prisma.storeTheme.findFirst({
        where: { tenantId, slug: dto.slug, id: { not: id } },
      });

      if (existingSlug) {
        throw new ConflictException('Theme with this slug already exists');
      }
    }

    // Merge colors if partial update
    let updatedColors = existing.colors;
    if (dto.colors) {
      updatedColors = { ...(existing.colors as object), ...(dto.colors as object) };
    }

    const updateData: Prisma.StoreThemeUpdateInput = {
      ...(dto.name && { name: dto.name }),
      ...(dto.slug && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.colors && { colors: updatedColors as any }),
      ...(dto.fontFamily && { fontFamily: dto.fontFamily }),
      ...(dto.headingFont !== undefined && { headingFont: dto.headingFont }),
      ...(dto.fontSize && { fontSize: dto.fontSize }),
      ...(dto.fontWeightBody && { fontWeightBody: dto.fontWeightBody }),
      ...(dto.fontWeightHeading && { fontWeightHeading: dto.fontWeightHeading }),
      ...(dto.layoutStyle && { layoutStyle: dto.layoutStyle }),
      ...(dto.headerStyle && { headerStyle: dto.headerStyle }),
      ...(dto.footerStyle && { footerStyle: dto.footerStyle }),
      ...(dto.spacing && { spacing: dto.spacing }),
      ...(dto.containerMaxWidth && { containerMaxWidth: dto.containerMaxWidth }),
      ...(dto.buttonStyle && { buttonStyle: dto.buttonStyle }),
      ...(dto.buttonSize && { buttonSize: dto.buttonSize }),
      ...(dto.cardStyle && { cardStyle: dto.cardStyle }),
      ...(dto.cardRadius && { cardRadius: dto.cardRadius }),
      ...(dto.inputStyle && { inputStyle: dto.inputStyle }),
      ...(dto.productGridColumns && { productGridColumns: dto.productGridColumns }),
      ...(dto.productImageRatio && { productImageRatio: dto.productImageRatio }),
      ...(dto.showQuickView !== undefined && { showQuickView: dto.showQuickView }),
      ...(dto.showWishlist !== undefined && { showWishlist: dto.showWishlist }),
      ...(dto.customCSS !== undefined && { customCSS: dto.customCSS ? this.sanitizeCss(dto.customCSS) : null }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
      ...(dto.previewImageUrl !== undefined && { previewImageUrl: dto.previewImageUrl }),
      ...(dto.tags && { tags: dto.tags }),
    };

    const theme = await this.prisma.storeTheme.update({
      where: { id },
      data: updateData,
    });

    // Clear cache if this was the active theme
    if (existing.isActive) {
      this.activeThemeCache.delete(tenantId);
    }

    return theme;
  }

  /**
   * Delete a custom theme
   */
  async deleteTheme(id: string, tenantId: string) {
    const existing = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Theme not found');
    }

    // Prevent deleting preset themes
    if (existing.isPreset) {
      throw new BadRequestException('Cannot delete preset themes.');
    }

    // Prevent deleting active theme
    if (existing.isActive) {
      throw new BadRequestException('Cannot delete the active theme. Please activate another theme first.');
    }

    await this.prisma.storeTheme.delete({
      where: { id },
    });

    return { success: true, message: 'Theme deleted successfully' };
  }

  /**
   * Activate a theme (deactivate all others)
   */
  async activateTheme(id: string, tenantId: string) {
    const theme = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    // Deactivate all other themes and activate this one
    await this.prisma.$transaction([
      this.prisma.storeTheme.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.storeTheme.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    // Clear cache
    this.activeThemeCache.delete(tenantId);

    return await this.getThemeById(id, tenantId);
  }

  /**
   * Duplicate a theme with a new name
   */
  async duplicateTheme(id: string, tenantId: string, newName: string) {
    const original = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId },
    });

    if (!original) {
      throw new NotFoundException('Theme not found');
    }

    // Generate a unique slug
    const baseSlug = this.generateSlug(newName);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.storeTheme.findFirst({ where: { tenantId, slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const duplicated = await this.prisma.storeTheme.create({
      data: {
        tenantId,
        name: newName,
        slug,
        description: original.description,
        isCustom: true,
        isPreset: false,
        isActive: false,
        colors: original.colors,
        fontFamily: original.fontFamily,
        headingFont: original.headingFont,
        fontSize: original.fontSize,
        fontWeightBody: original.fontWeightBody,
        fontWeightHeading: original.fontWeightHeading,
        layoutStyle: original.layoutStyle,
        headerStyle: original.headerStyle,
        footerStyle: original.footerStyle,
        spacing: original.spacing,
        containerMaxWidth: original.containerMaxWidth,
        buttonStyle: original.buttonStyle,
        buttonSize: original.buttonSize,
        cardStyle: original.cardStyle,
        cardRadius: original.cardRadius,
        inputStyle: original.inputStyle,
        productGridColumns: original.productGridColumns,
        productImageRatio: original.productImageRatio,
        showQuickView: original.showQuickView,
        showWishlist: original.showWishlist,
        customCSS: original.customCSS,
        logoUrl: original.logoUrl,
        faviconUrl: original.faviconUrl,
        previewImageUrl: original.previewImageUrl,
        tags: original.tags,
      },
    });

    return duplicated;
  }

  /**
   * Reset to a preset theme
   */
  async resetToPreset(tenantId: string, presetSlug: string) {
    const preset = getPresetBySlug(presetSlug);

    if (!preset) {
      throw new NotFoundException(`Preset theme '${presetSlug}' not found`);
    }

    // Check if this preset already exists for the tenant
    const existing = await this.prisma.storeTheme.findFirst({
      where: { tenantId, slug: preset.slug, isPreset: true },
    });

    if (existing) {
      // Activate existing preset
      return await this.activateTheme(existing.id, tenantId);
    }

    // Create and activate the preset
    const theme = await this.prisma.storeTheme.create({
      data: {
        tenantId,
        ...preset,
        colors: preset.colors as any,
      },
    });

    return await this.activateTheme(theme.id, tenantId);
  }

  /**
   * Seed preset themes (run on module init)
   */
  async seedPresets() {
    try {
      const presets = getAllPresets();
      this.logger.log(`Checking ${presets.length} theme presets...`);

      // Get all tenants
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });

      for (const tenant of tenants) {
        for (const preset of presets) {
          // Check if preset already exists for this tenant
          const existing = await this.prisma.storeTheme.findFirst({
            where: {
              tenantId: tenant.id,
              slug: preset.slug,
              isPreset: true,
            },
          });

          if (!existing) {
            await this.prisma.storeTheme.create({
              data: {
                tenantId: tenant.id,
                ...preset,
                colors: preset.colors as any,
              },
            });
            this.logger.log(`Created preset theme '${preset.name}' for tenant ${tenant.id}`);
          }
        }

        // Ensure at least one theme is active
        const activeTheme = await this.prisma.storeTheme.findFirst({
          where: { tenantId: tenant.id, isActive: true },
        });

        if (!activeTheme) {
          // Activate the modern theme by default
          const modernTheme = await this.prisma.storeTheme.findFirst({
            where: { tenantId: tenant.id, slug: 'modern' },
          });

          if (modernTheme) {
            await this.prisma.storeTheme.update({
              where: { id: modernTheme.id },
              data: { isActive: true },
            });
            this.logger.log(`Activated default 'Modern' theme for tenant ${tenant.id}`);
          }
        }
      }

      this.logger.log('Theme presets seeding completed');
    } catch (error) {
      this.logger.error('Error seeding theme presets:', error);
    }
  }

  /**
   * Helper: Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Sanitize custom CSS to prevent script injection and dangerous properties.
   * Strips javascript: URLs, expression(), behavior, and @import.
   */
  private sanitizeCss(css: string): string {
    return css
      .replace(/javascript\s*:/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/behavior\s*:/gi, '')
      .replace(/@import\b/gi, '')
      .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
      .replace(/-moz-binding\s*:/gi, '');
  }
}
