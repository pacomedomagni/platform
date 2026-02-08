import {
  Controller,
  Get,
  Put,
  Headers,
  Param,
  Body,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { StoreAdminGuard } from '@platform/auth';
import { SeoService } from './seo.service';

@Controller('store/admin/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Put('products/:productId')
  @UseGuards(StoreAdminGuard)
  async updateProductSEO(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Body() body: { metaTitle?: string; metaDescription?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.seoService.updateProductSEO(tenantId, productId, body);
  }

  @Put('pages/:pageId')
  @UseGuards(StoreAdminGuard)
  async updatePageSEO(
    @Headers('x-tenant-id') tenantId: string,
    @Param('pageId') pageId: string,
    @Body()
    body: {
      metaTitle?: string;
      metaDescription?: string;
      ogImage?: string;
      structuredData?: Record<string, unknown>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.seoService.updatePageSEO(tenantId, pageId, body);
  }

  @Get('sitemap.xml')
  async generateSitemap(
    @Headers('x-tenant-id') tenantId: string,
    @Res() res: Response,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const xml = await this.seoService.generateSitemap(tenantId);
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  }

  @Get('structured-data/:productId')
  async getStructuredData(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.seoService.generateStructuredData(tenantId, productId);
  }

  @Get('audit')
  @UseGuards(StoreAdminGuard)
  async getSEOAudit(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.seoService.getSEOAudit(tenantId);
  }
}
