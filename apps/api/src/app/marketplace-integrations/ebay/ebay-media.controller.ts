import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayMediaService } from './ebay-media.service';
import { UploadImageFromUrlDto, UploadImageFromFileDto } from '../shared/marketplace.dto';

/**
 * eBay Media API Controller
 * Manages image uploads via the eBay Commerce Media API
 */
@Controller('marketplace/media')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayMediaController {
  constructor(private mediaService: EbayMediaService) {}

  /**
   * Upload an image from a URL
   * POST /api/marketplace/media/upload-url
   */
  @Post('upload-url')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async uploadImageFromUrl(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: UploadImageFromUrlDto
  ) {
    return this.mediaService.uploadImageFromUrl(dto.connectionId, dto.imageUrl);
  }

  /**
   * Upload an image from base64-encoded file content
   * POST /api/marketplace/media/upload
   */
  @Post('upload')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async uploadImageFromFile(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: UploadImageFromFileDto
  ) {
    const buffer = Buffer.from(dto.fileContent, 'base64');
    return this.mediaService.uploadImageFromFile(
      dto.connectionId,
      buffer,
      dto.contentType
    );
  }

  /**
   * Get image details by image ID
   * GET /api/marketplace/media/:imageId?connectionId=...
   */
  @Get(':imageId')
  async getImage(
    @Tenant() tenantId: string,
    @Param('imageId') imageId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.mediaService.getImage(connectionId, imageId);
  }
}
