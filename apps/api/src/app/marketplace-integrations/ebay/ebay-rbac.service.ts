import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { MarketplacePermission } from '../shared/marketplace.types';

/**
 * Role template interface for marketplace RBAC.
 */
export interface MarketplaceRoleTemplate {
  name: string;
  description: string;
  permissions: string[];
}

/**
 * Static role templates for marketplace RBAC.
 * Each template defines a preset combination of marketplace permissions.
 */
const ROLE_TEMPLATES: MarketplaceRoleTemplate[] = [
  {
    name: 'Owner',
    description: 'Full access to all marketplace features and settings',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.CONNECTIONS_MANAGE,
      MarketplacePermission.LISTINGS_CREATE,
      MarketplacePermission.LISTINGS_APPROVE,
      MarketplacePermission.LISTINGS_PUBLISH,
      MarketplacePermission.RETURNS_MANAGE,
      MarketplacePermission.MESSAGES_MANAGE,
      MarketplacePermission.CAMPAIGNS_MANAGE,
      MarketplacePermission.FINANCES_VIEW,
      MarketplacePermission.SETTINGS_MANAGE,
    ],
  },
  {
    name: 'Store Manager',
    description:
      'Manages listings, returns, messages, and campaigns without access to connections, settings, or finances',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.LISTINGS_CREATE,
      MarketplacePermission.LISTINGS_APPROVE,
      MarketplacePermission.LISTINGS_PUBLISH,
      MarketplacePermission.RETURNS_MANAGE,
      MarketplacePermission.MESSAGES_MANAGE,
      MarketplacePermission.CAMPAIGNS_MANAGE,
    ],
  },
  {
    name: 'Listing Specialist',
    description: 'Creates, approves, and publishes marketplace listings',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.LISTINGS_CREATE,
      MarketplacePermission.LISTINGS_APPROVE,
      MarketplacePermission.LISTINGS_PUBLISH,
    ],
  },
  {
    name: 'Order Processor',
    description: 'Handles returns and buyer messaging',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.RETURNS_MANAGE,
      MarketplacePermission.MESSAGES_MANAGE,
    ],
  },
  {
    name: 'Marketing Manager',
    description: 'Manages advertising campaigns and creates listings for promotional purposes',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.CAMPAIGNS_MANAGE,
      MarketplacePermission.LISTINGS_CREATE,
    ],
  },
  {
    name: 'Customer Service',
    description: 'Manages returns and buyer communications',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.RETURNS_MANAGE,
      MarketplacePermission.MESSAGES_MANAGE,
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access to marketplace data and financial reports',
    permissions: [
      MarketplacePermission.MARKETPLACE_VIEW,
      MarketplacePermission.FINANCES_VIEW,
    ],
  },
];

/**
 * eBay RBAC Role Templates Service
 * Provides predefined role templates for marketplace permission management.
 * Role templates are static data that map common job functions to marketplace permissions.
 */
@Injectable()
export class EbayRbacService {
  private readonly logger = new Logger(EbayRbacService.name);

  constructor(
    private prisma: PrismaService,
    private cls: ClsService
  ) {}

  /**
   * Get all available role templates.
   */
  getRoleTemplates(): MarketplaceRoleTemplate[] {
    return ROLE_TEMPLATES;
  }

  /**
   * Get a single role template by name.
   * Returns null if the template is not found.
   */
  getRoleTemplate(name: string): MarketplaceRoleTemplate | null {
    return (
      ROLE_TEMPLATES.find(
        (template) => template.name.toLowerCase() === name.toLowerCase()
      ) || null
    );
  }

  /**
   * Get the permissions list for a given role name.
   * Returns an empty array if the role is not found.
   */
  getPermissionsForRole(roleName: string): string[] {
    const template = this.getRoleTemplate(roleName);
    return template ? template.permissions : [];
  }

  /**
   * Check if a user's permissions include a specific required permission.
   */
  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Get effective permissions for a user.
   * Placeholder: returns Owner permissions for now since fine-grained RBAC
   * integration with the existing user/roles system would require more
   * architectural work.
   */
  async getUserEffectivePermissions(
    tenantId: string,
    userId: string
  ): Promise<string[]> {
    this.logger.debug(
      `Getting effective permissions for user ${userId} in tenant ${tenantId}`
    );

    // TODO: Integrate with existing user/roles system for fine-grained RBAC.
    // For now, return Owner-level permissions as a placeholder.
    const ownerTemplate = this.getRoleTemplate('Owner');
    return ownerTemplate ? ownerTemplate.permissions : [];
  }
}
