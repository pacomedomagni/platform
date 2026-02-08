import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { PageSectionsService } from './sections.service';

@Controller('store/admin/pages/:pageId/sections')
@UseGuards(StoreAdminGuard)
export class PageSectionsController {
  constructor(private readonly sectionsService: PageSectionsService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string, @Param('pageId') pageId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.sectionsService.listSections(tenantId, pageId);
  }

  @Post()
  async add(
    @Headers('x-tenant-id') tenantId: string,
    @Param('pageId') pageId: string,
    @Body() body: { type: string; config?: Record<string, unknown>; position?: number },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.sectionsService.addSection(tenantId, pageId, body);
  }

  @Put(':sectionId')
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: { type?: string; config?: Record<string, unknown>; position?: number },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.sectionsService.updateSection(tenantId, sectionId, body);
  }

  @Post('reorder')
  async reorder(
    @Headers('x-tenant-id') tenantId: string,
    @Param('pageId') pageId: string,
    @Body() body: { sectionIds: string[] },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.sectionsService.reorderSections(tenantId, pageId, body.sectionIds);
  }

  @Delete(':sectionId')
  async delete(@Headers('x-tenant-id') tenantId: string, @Param('sectionId') sectionId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.sectionsService.deleteSection(tenantId, sectionId);
  }
}
