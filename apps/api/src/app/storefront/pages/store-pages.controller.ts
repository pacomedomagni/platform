import { Controller, Get, Put, Delete, Param, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { StorePagesService } from './store-pages.service';
import { UpsertStorePageDto } from './store-pages.dto';
import { StoreAdminGuard } from '@platform/auth';
import { StorePublishedGuard } from '../../common/guards/store-published.guard';

@Controller('store')
export class StorePagesController {
  constructor(private readonly pagesService: StorePagesService) {}

  /**
   * GET /api/v1/store/pages — public, list published pages
   */
  @Get('pages')
  @UseGuards(StorePublishedGuard)
  async listPages(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.listPages(tenantId, true);
  }

  /**
   * GET /api/v1/store/pages/:slug — public, get single page
   */
  @Get('pages/:slug')
  @UseGuards(StorePublishedGuard)
  async getPage(
    @Req() req: Request,
    @Param('slug') slug: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.getPage(tenantId, slug);
  }

  /**
   * PUT /api/v1/store/admin/pages/:slug — admin, upsert page
   */
  @Put('admin/pages/:slug')
  @UseGuards(StoreAdminGuard)
  async upsertPage(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: UpsertStorePageDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.upsertPage(tenantId, slug, dto);
  }

  /**
   * GET /api/v1/store/admin/pages — admin, list all pages (including unpublished)
   */
  @Get('admin/pages')
  @UseGuards(StoreAdminGuard)
  async listAllPages(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.listPages(tenantId, false);
  }

  /**
   * DELETE /api/v1/store/admin/pages/:slug — admin, delete page
   */
  @Delete('admin/pages/:slug')
  @UseGuards(StoreAdminGuard)
  async deletePage(
    @Req() req: Request,
    @Param('slug') slug: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.deletePage(tenantId, slug);
  }
}
