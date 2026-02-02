import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { DocTypeDefinition, DocPermDefinition } from './types';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(private readonly schemaService: SchemaService) {}

  async checkPermission(docType: string, userRoles: string[], action: keyof DocPermDefinition): Promise<boolean> {
      if (userRoles.includes('admin') || userRoles.includes('System Manager')) return true;

      const def = await this.schemaService.getDocType(docType);
      if (!def) return false; // Or throw?

      // If no permissions defined, maybe default to open or closed? 
      // Safe default: Closed unless empty? 
      // Let's say if no perms defined, only System Manager can access.
      if (!def.permissions || def.permissions.length === 0) {
          // Allow if system is in bootstrap mode? No, better secure.
          // For now, if no perms, deny.
          return false;
      }

      // Check if any of the user's roles match a permission rule that allows the action
      // We look for ONE match that allows it.
      const hasPerm = def.permissions.some(perm => {
          return userRoles.includes(perm.role) && perm[action] === true;
      });

      return hasPerm;
  }

  async ensurePermission(docType: string, userRoles: string[], action: keyof DocPermDefinition) {
      const allowed = await this.checkPermission(docType, userRoles, action);
      if (!allowed) {
          throw new ForbiddenException(`You do not have ${action} permission for ${docType}`);
      }
  }
}
