import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { CrmService } from './crm.service';

@Controller('store/admin/crm')
@UseGuards(StoreAdminGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ─── Notes ──────────────────────────────────────────────────

  /**
   * List notes for a store customer
   * GET /api/v1/store/admin/crm/notes/:storeCustomerId
   */
  @Get('notes/:storeCustomerId')
  async listNotes(
    @Headers('x-tenant-id') tenantId: string,
    @Param('storeCustomerId') storeCustomerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.listNotes(tenantId, storeCustomerId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Create a note
   * POST /api/v1/store/admin/crm/notes
   */
  @Post('notes')
  async createNote(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      storeCustomerId: string;
      content: string;
      createdBy?: string;
      isPinned?: boolean;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.createNote(tenantId, body);
  }

  /**
   * Update a note
   * PUT /api/v1/store/admin/crm/notes/:id
   */
  @Put('notes/:id')
  async updateNote(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: { content?: string; isPinned?: boolean },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.updateNote(tenantId, id, body);
  }

  /**
   * Delete a note
   * DELETE /api/v1/store/admin/crm/notes/:id
   */
  @Delete('notes/:id')
  async deleteNote(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.deleteNote(tenantId, id);
  }

  // ─── Tags ──────────────────────────────────────────────────

  /**
   * List all tags
   * GET /api/v1/store/admin/crm/tags
   */
  @Get('tags')
  async listTags(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.listTags(tenantId);
  }

  /**
   * Create a tag
   * POST /api/v1/store/admin/crm/tags
   */
  @Post('tags')
  async createTag(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { name: string; color?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.createTag(tenantId, body);
  }

  /**
   * Delete a tag
   * DELETE /api/v1/store/admin/crm/tags/:id
   */
  @Delete('tags/:id')
  async deleteTag(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.deleteTag(tenantId, id);
  }

  /**
   * Tag a customer (link tag to customer)
   * POST /api/v1/store/admin/crm/tags/:tagId/link
   */
  @Post('tags/:tagId/link')
  async tagCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tagId') tagId: string,
    @Body() body: { storeCustomerId: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.tagCustomer(tenantId, tagId, body.storeCustomerId);
  }

  /**
   * Untag a customer (unlink tag from customer)
   * DELETE /api/v1/store/admin/crm/tags/:tagId/link/:storeCustomerId
   */
  @Delete('tags/:tagId/link/:storeCustomerId')
  async untagCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tagId') tagId: string,
    @Param('storeCustomerId') storeCustomerId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.untagCustomer(tenantId, tagId, storeCustomerId);
  }

  /**
   * Get all tags for a customer
   * GET /api/v1/store/admin/crm/customers/:storeCustomerId/tags
   */
  @Get('customers/:storeCustomerId/tags')
  async getCustomerTags(
    @Headers('x-tenant-id') tenantId: string,
    @Param('storeCustomerId') storeCustomerId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.crmService.getCustomerTags(tenantId, storeCustomerId);
  }
}
