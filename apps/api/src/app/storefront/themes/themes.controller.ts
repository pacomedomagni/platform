import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ThemesService } from './themes.service';
import { CreateThemeDto, UpdateThemeDto } from './dto';
import { StoreAdminGuard } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';

@Controller('store')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  /**
   * List all themes for a tenant (public - for theme selector)
   * GET /api/v1/store/themes
   */
  @Get('themes')
  async listThemes(@Tenant() tenantId: string) {    return this.themesService.getThemes(tenantId);
  }

  /**
   * Get the currently active theme (public)
   * GET /api/v1/store/themes/active
   */
  @Get('themes/active')
  async getActiveTheme(@Tenant() tenantId: string) {    return this.themesService.getActiveTheme(tenantId);
  }

  /**
   * Get all preset themes (public)
   * GET /api/v1/store/themes/presets
   */
  @Get('themes/presets')
  async getPresets() {
    return this.themesService.getPresets();
  }

  /**
   * Get a specific preset by type (public)
   * GET /api/v1/store/themes/presets/:type
   */
  @Get('themes/presets/:type')
  async getPresetByType(@Param('type') type: string) {
    const presets = await this.themesService.getPresets();
    const preset = presets.find((p: any) => p.slug === type || p.name?.toLowerCase() === type.toLowerCase());
    if (!preset) {
      throw new BadRequestException('Preset not found');
    }
    return preset;
  }

  /**
   * Get a specific theme by ID (public)
   * GET /api/v1/store/themes/:id
   */
  @Get('themes/:id')
  async getThemeById(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.themesService.getThemeById(id, tenantId);
  }

  // ============ ADMIN ENDPOINTS ============

  /**
   * Create a new custom theme (admin)
   * POST /api/v1/store/admin/themes
   */
  @Post('admin/themes')
  @UseGuards(StoreAdminGuard)
  async createTheme(
    @Tenant() tenantId: string,
    @Body() dto: CreateThemeDto
  ) {    return this.themesService.createTheme(tenantId, dto);
  }

  /**
   * Validate theme data (admin)
   * POST /api/v1/store/admin/themes/validate
   */
  @Post('admin/themes/validate')
  @UseGuards(StoreAdminGuard)
  async validateTheme(
    @Tenant() tenantId: string,
    @Body() dto: CreateThemeDto
  ) {    // Validation is done by the global validation pipe on CreateThemeDto
    return { valid: true };
  }

  /**
   * Create theme from preset (admin)
   * POST /api/v1/store/admin/themes/from-preset/:presetType
   */
  @Post('admin/themes/from-preset/:presetType')
  @UseGuards(StoreAdminGuard)
  async createFromPreset(
    @Tenant() tenantId: string,
    @Param('presetType') presetType: string,
    @Body() body: { name?: string }
  ) {    return this.themesService.resetToPreset(tenantId, presetType);
  }

  /**
   * Update a theme (admin)
   * PUT /api/v1/store/admin/themes/:id
   */
  @Put('admin/themes/:id')
  @UseGuards(StoreAdminGuard)
  async updateTheme(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto
  ) {    return this.themesService.updateTheme(id, tenantId, dto);
  }

  /**
   * Delete a custom theme (admin)
   * DELETE /api/v1/store/admin/themes/:id
   */
  @Delete('admin/themes/:id')
  @UseGuards(StoreAdminGuard)
  async deleteTheme(
    @Tenant() tenantId: string,
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const actorId = (req as any).user?.userId ?? (req as any).user?.sub ?? (req as any).user?.id ?? undefined;
    return this.themesService.deleteTheme(id, tenantId, actorId);
  }

  /**
   * Restore a soft-deleted theme (used by the frontend's Undo toast within ~5s).
   * POST /api/v1/store/admin/themes/:id/restore
   */
  @Post('admin/themes/:id/restore')
  @UseGuards(StoreAdminGuard)
  async restoreTheme(
    @Tenant() tenantId: string,
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const actorId = (req as any).user?.userId ?? (req as any).user?.sub ?? (req as any).user?.id ?? undefined;
    return this.themesService.restoreTheme(id, tenantId, actorId);
  }

  /**
   * Activate a theme (admin)
   * POST /api/v1/store/admin/themes/:id/activate
   */
  @Post('admin/themes/:id/activate')
  @UseGuards(StoreAdminGuard)
  async activateTheme(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.themesService.activateTheme(id, tenantId);
  }

  /**
   * Duplicate a theme (admin)
   * POST /api/v1/store/admin/themes/:id/duplicate
   * Body: { name: string }
   */
  @Post('admin/themes/:id/duplicate')
  @UseGuards(StoreAdminGuard)
  async duplicateTheme(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body('name') name: string
  ) {    if (!name) {
      throw new BadRequestException('Theme name is required');
    }
    return this.themesService.duplicateTheme(id, tenantId, name);
  }

  /**
   * Reset specific theme to preset defaults (admin)
   * POST /api/v1/store/admin/themes/:id/reset
   */
  @Post('admin/themes/:id/reset')
  @UseGuards(StoreAdminGuard)
  async resetTheme(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    const theme = await this.themesService.getThemeById(id, tenantId);
    if (!theme) throw new BadRequestException('Theme not found');
    // Reset by activating the preset version
    const presetSlug = (theme as any).presetSlug || (theme as any).slug || 'modern';
    return this.themesService.resetToPreset(tenantId, presetSlug);
  }

  /**
   * Reset to a preset theme (admin)
   * POST /api/v1/store/admin/themes/reset-preset
   * Body: { presetSlug: string }
   */
  @Post('admin/themes/reset-preset')
  @UseGuards(StoreAdminGuard)
  async resetToPreset(
    @Tenant() tenantId: string,
    @Body('presetSlug') presetSlug: string
  ) {    if (!presetSlug) {
      throw new BadRequestException('Preset slug is required');
    }
    return this.themesService.resetToPreset(tenantId, presetSlug);
  }
}
