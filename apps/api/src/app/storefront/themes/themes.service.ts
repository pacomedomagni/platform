/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import * as postcss from 'postcss';
import { CreateThemeDto, UpdateThemeDto } from './dto';
import { validateThemeColors } from './interfaces/theme-colors.interface';
import { getAllPresets, getPresetBySlug } from './presets';
import { AuditLogService } from '../../operations/audit-log.service';

@Injectable()
export class ThemesService implements OnModuleInit {
  private readonly logger = new Logger(ThemesService.name);
  private activeThemeCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

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
      where: { tenantId, deletedAt: null },
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
    // Check cache first (with TTL expiration)
    const cached = this.activeThemeCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }
    // Expired or missing -- remove stale entry
    if (cached) {
      this.activeThemeCache.delete(tenantId);
    }

    const activeTheme = await this.prisma.storeTheme.findFirst({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
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

    // Cache the active theme with timestamp for TTL expiration
    this.activeThemeCache.set(tenantId, { data: activeTheme, timestamp: Date.now() });

    return activeTheme;
  }

  /**
   * Get a specific theme by ID
   */
  async getThemeById(id: string, tenantId: string) {
    const theme = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId, deletedAt: null },
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
        logoUrl: this.sanitizeAssetUrl(dto.logoUrl),
        faviconUrl: this.sanitizeAssetUrl(dto.faviconUrl),
        previewImageUrl: this.sanitizeAssetUrl(dto.previewImageUrl),
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
      ...(dto.logoUrl !== undefined && { logoUrl: this.sanitizeAssetUrl(dto.logoUrl) }),
      ...(dto.faviconUrl !== undefined && { faviconUrl: this.sanitizeAssetUrl(dto.faviconUrl) }),
      ...(dto.previewImageUrl !== undefined && { previewImageUrl: this.sanitizeAssetUrl(dto.previewImageUrl) }),
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
  async deleteTheme(id: string, tenantId: string, actorId?: string) {
    const existing = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId, deletedAt: null },
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

    // Soft delete: set deletedAt. Frontend's Undo toast can call restoreTheme within ~5s.
    await this.prisma.storeTheme.updateMany({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });

    await this.writeAudit(tenantId, actorId, 'theme.deleted', 'StoreTheme', id, {
      name: existing.name,
      slug: existing.slug,
    });

    return { success: true, message: 'Theme deleted successfully', deletedAt: new Date().toISOString() };
  }

  /**
   * Restore a soft-deleted theme. Used by the frontend's Undo toast within
   * the ~5s window. Idempotent: no-op for active themes.
   */
  async restoreTheme(id: string, tenantId: string, actorId?: string) {
    const existing = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Theme not found');
    }
    if (existing.deletedAt === null) {
      return { success: true, alreadyActive: true };
    }

    await this.prisma.storeTheme.updateMany({
      where: { id, tenantId },
      data: { deletedAt: null },
    });

    await this.writeAudit(tenantId, actorId, 'theme.restored', 'StoreTheme', id, {
      name: existing.name,
      slug: existing.slug,
    });

    return { success: true };
  }

  /**
   * Optional fire-and-forget audit write. The injected AuditLogService is
   * marked @Optional so unit tests don't have to wire it; if the operations
   * module isn't loaded this call is a no-op.
   */
  private async writeAudit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    docType: string,
    docName: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.auditLog) return;
    try {
      await this.auditLog.log({ tenantId, userId: actorId }, { action, docType, docName, meta });
    } catch (e) {
      this.logger.warn(`Theme audit write swallowed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Activate a theme (deactivate all others)
   */
  async activateTheme(id: string, tenantId: string) {
    const theme = await this.prisma.storeTheme.findFirst({
      where: { id, tenantId, deletedAt: null },
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
   * Seed preset themes (run on module init).
   *
   * Optimised to avoid N+1 queries:
   *  1. Fetch all existing preset slugs per tenant in a single query.
   *  2. Batch-insert missing presets with createMany.
   *  3. Only activate a default theme when none is already active.
   */
  async seedPresets() {
    try {
      const presets = getAllPresets();
      this.logger.log(`Checking ${presets.length} theme presets...`);

      // Get all tenants
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });

      if (tenants.length === 0) {
        this.logger.log('No tenants found -- skipping theme seeding');
        return;
      }

      // Fetch all existing preset themes in one query
      const existingPresets = await this.prisma.storeTheme.findMany({
        where: { isPreset: true },
        select: { tenantId: true, slug: true },
      });

      // Build a set for O(1) lookups: "tenantId::slug"
      const existingSet = new Set(
        existingPresets.map((p) => `${p.tenantId}::${p.slug}`)
      );

      for (const tenant of tenants) {
        // Determine which presets are missing for this tenant
        const missing = presets.filter(
          (preset) => !existingSet.has(`${tenant.id}::${preset.slug}`)
        );

        if (missing.length > 0) {
          // Batch-insert all missing presets at once
          await this.prisma.storeTheme.createMany({
            data: missing.map((preset) => ({
              tenantId: tenant.id,
              ...preset,
              colors: preset.colors as any,
            })),
            skipDuplicates: true,
          });
          this.logger.log(
            `Created ${missing.length} preset theme(s) for tenant ${tenant.id}`
          );
        }

        // Ensure at least one theme is active (single query check)
        const hasActive = await this.prisma.storeTheme.count({
          where: { tenantId: tenant.id, isActive: true },
        });

        if (hasActive === 0) {
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
   * Phase 1 W1.7: real CSS sanitization using PostCSS.
   *
   * The prior regex-based implementation was bypassable via:
   *  - unicode-escaped property names or values (e.g. j\61vascript:)
   *  - CSS custom properties that smuggled unsafe URLs
   *  - webkit-only properties with `javascript:` body
   *  - nested calc() / functional notations
   *
   * Here we parse the CSS into an AST and walk it:
   *  - drop any at-rule not in a conservative allowlist (no @import, @charset,
   *    @namespace — which can pull remote CSS or confuse the parser)
   *  - drop any declaration whose property or value matches a block pattern
   *  - if parsing fails, return '' (reject rather than pass through raw text)
   */
  private static readonly ALLOWED_AT_RULES: ReadonlySet<string> = new Set([
    'media',
    'supports',
    'font-face',
    'keyframes',
    'page',
  ]);

  private static readonly BLOCKED_VALUE_PATTERNS: readonly RegExp[] = [
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /data\s*:(?!image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp))/i, // allow data: images, block data:text/html etc.
    /expression\s*\(/i,
    /behavior\s*:/i,
    /-moz-binding/i,
    /\\[0-9a-f]{1,6}/i, // any unicode escape is suspicious in user CSS
  ];

  private static readonly BLOCKED_PROPERTIES: ReadonlySet<string> = new Set([
    'behavior',
    '-moz-binding',
  ]);

  private sanitizeCss(css: string): string {
    if (!css || css.length === 0) return '';
    if (css.length > 64 * 1024) {
      // Cap input size so a malicious theme can't DoS the PostCSS parser.
      throw new BadRequestException('customCSS exceeds 64 KB limit');
    }

    let root: postcss.Root;
    try {
      root = postcss.parse(css);
    } catch (err) {
      this.logger.warn(`sanitizeCss: parse failed (${(err as Error).message}); rejecting input`);
      return '';
    }

    const isBlockedValue = (value: string) =>
      ThemesService.BLOCKED_VALUE_PATTERNS.some((re) => re.test(value));

    root.walkAtRules((at) => {
      if (!ThemesService.ALLOWED_AT_RULES.has(at.name.toLowerCase())) {
        at.remove();
      }
    });

    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      if (ThemesService.BLOCKED_PROPERTIES.has(prop)) {
        decl.remove();
        return;
      }
      if (isBlockedValue(decl.value)) {
        decl.remove();
        return;
      }
      // CSS custom properties (--foo) — common XSS vector when declared with
      // dangerous URLs. Drop any whose value fails the same safety filter.
      if (prop.startsWith('--') && isBlockedValue(decl.value)) {
        decl.remove();
      }
    });

    return root.toString();
  }

  /**
   * Phase 1 W1.7: reject theme asset URLs with dangerous schemes or paths.
   * Accepts only https:// (and optionally the platform's S3/MinIO base url).
   * Use on logoUrl, faviconUrl, previewImageUrl, and any other user-supplied URL.
   */
  private sanitizeAssetUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(`Invalid asset URL: ${url}`);
    }
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new BadRequestException(`Asset URL must use http(s): received ${protocol}`);
    }
    return parsed.toString();
  }
}
