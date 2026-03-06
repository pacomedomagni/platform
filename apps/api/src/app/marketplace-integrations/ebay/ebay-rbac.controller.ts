import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayRbacService } from './ebay-rbac.service';
import { MarketplacePermission } from '../shared/marketplace.types';

/**
 * eBay RBAC API Controller
 * Provides marketplace role templates and permission lookups
 */
@Controller('marketplace/rbac')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EbayRbacController {
  constructor(private rbacService: EbayRbacService) {}

  /**
   * List all role templates
   * GET /api/marketplace/rbac/templates
   */
  @Get('templates')
  @Roles('admin', 'System Manager')
  async getRoleTemplates(@Tenant() tenantId: string) {
    const templates = this.rbacService.getRoleTemplates();
    return {
      success: true,
      templates,
    };
  }

  /**
   * Get a single role template by name
   * GET /api/marketplace/rbac/templates/:name
   */
  @Get('templates/:name')
  @Roles('admin', 'System Manager')
  async getRoleTemplate(
    @Tenant() tenantId: string,
    @Param('name') name: string
  ) {
    const template = this.rbacService.getRoleTemplate(name);
    if (!template) {
      throw new NotFoundException(`Role template "${name}" not found`);
    }
    return {
      success: true,
      template,
    };
  }

  /**
   * List all available marketplace permissions
   * GET /api/marketplace/rbac/permissions
   */
  @Get('permissions')
  @Roles('admin', 'System Manager')
  async getPermissions(@Tenant() tenantId: string) {
    const permissions = Object.values(MarketplacePermission);
    return {
      success: true,
      permissions,
    };
  }
}
