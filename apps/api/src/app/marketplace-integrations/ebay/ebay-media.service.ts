import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Media Service
 * Manages image uploads via the eBay Commerce Media API.
 * Supports uploading images from URLs, from file buffers, and retrieving image details.
 */
@Injectable()
export class EbayMediaService {
  private readonly logger = new Logger(EbayMediaService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * Upload an image to eBay from a URL.
   * Uses the Commerce Media API createImageFromUrl endpoint.
   */
  async uploadImageFromUrl(
    connectionId: string,
    imageUrl: string
  ): Promise<{ imageId: string; imageUrl: string }> {
    if (this.mockMode) {
      const mockImageId = `mock_image_${Date.now()}`;
      this.logger.log(
        `[MOCK] Uploaded image from URL for connection ${connectionId}: ${imageUrl} (${mockImageId})`
      );
      return {
        imageId: mockImageId,
        imageUrl: `https://i.ebayimg.com/images/mock/${mockImageId}/s-l1600.jpg`,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).media.createImageFromUrl({
        imageUrl,
      });

      const imageId =
        response?.imageId ||
        response?.href?.split('/').pop() ||
        `ebay_image_${Date.now()}`;

      const resultUrl = response?.imageUrl || imageUrl;

      this.logger.log(
        `Uploaded image from URL for connection ${connectionId}: ${imageUrl} (${imageId})`
      );

      return {
        imageId,
        imageUrl: resultUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload image from URL for connection ${connectionId}: ${imageUrl}`,
        error
      );
      throw error;
    }
  }

  /**
   * Upload an image to eBay from a file buffer.
   * Uses the Commerce Media API createImageFromFile endpoint.
   */
  async uploadImageFromFile(
    connectionId: string,
    fileContent: Buffer,
    contentType: string
  ): Promise<{ imageId: string; imageUrl: string }> {
    if (this.mockMode) {
      const mockImageId = `mock_image_file_${Date.now()}`;
      this.logger.log(
        `[MOCK] Uploaded image from file for connection ${connectionId} (${contentType}, ${fileContent.length} bytes) (${mockImageId})`
      );
      return {
        imageId: mockImageId,
        imageUrl: `https://i.ebayimg.com/images/mock/${mockImageId}/s-l1600.jpg`,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).media.createImageFromFile(
        fileContent,
        contentType
      );

      const imageId =
        response?.imageId ||
        response?.href?.split('/').pop() ||
        `ebay_image_${Date.now()}`;

      const imageUrl =
        response?.imageUrl ||
        `https://i.ebayimg.com/images/${imageId}/s-l1600.jpg`;

      this.logger.log(
        `Uploaded image from file for connection ${connectionId} (${contentType}, ${fileContent.length} bytes) (${imageId})`
      );

      return {
        imageId,
        imageUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload image from file for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  // ============================================
  // Video Support (L4)
  // ============================================

  /**
   * L4: Create a video on eBay and get an upload URL.
   * eBay Commerce Media API requires: 1) createVideo (get videoId + upload URL),
   * 2) Upload the video binary to the upload URL, 3) Wait for processing.
   *
   * Videos must be: MP4, H.264, 30 sec min, 1 min max recommended,
   * 225MB max, min 480x480 resolution.
   */
  async createVideo(
    connectionId: string,
    title: string,
    description?: string
  ): Promise<{ videoId: string; uploadUrl: string }> {
    if (this.mockMode) {
      const mockVideoId = `mock_video_${Date.now()}`;
      this.logger.log(`[MOCK] Created video for connection ${connectionId}: ${title} (${mockVideoId})`);
      return {
        videoId: mockVideoId,
        uploadUrl: `https://api.ebay.com/commerce/media/v1_beta/video/${mockVideoId}/upload`,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).media.createVideo({
        title,
        description: description || title,
      });

      const videoId = response?.videoId || response?.href?.split('/').pop();
      // The upload URL is typically in the response headers (Location) or in the body
      const uploadUrl = response?.uploadUrl ||
        `https://apiz.ebay.com/commerce/media/v1_beta/video/${videoId}/upload`;

      this.logger.log(`Created video ${videoId} for connection ${connectionId}`);

      return { videoId, uploadUrl };
    } catch (error) {
      this.logger.error(`Failed to create video for connection ${connectionId}`, error);
      throw error;
    }
  }

  /**
   * L4: Get video processing status and playable URL.
   * After upload, eBay processes the video. Status progresses:
   * PENDING_UPLOAD → PROCESSING → LIVE (or BLOCKED/PROCESSING_FAILED).
   */
  async getVideo(connectionId: string, videoId: string): Promise<{
    videoId: string;
    status: string;
    playableUrl?: string;
    thumbnail?: string;
  }> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched video ${videoId} for connection ${connectionId}`);
      return {
        videoId,
        status: 'LIVE',
        playableUrl: `https://www.ebay.com/video/${videoId}`,
        thumbnail: `https://i.ebayimg.com/images/mock/${videoId}/thumb.jpg`,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).media.getVideo(videoId);

      return {
        videoId: response?.videoId || videoId,
        status: response?.status || 'UNKNOWN',
        playableUrl: response?.playableUrl,
        thumbnail: response?.thumbnail?.imageUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to get video ${videoId} for connection ${connectionId}`, error);
      throw error;
    }
  }

  /**
   * Get image details from eBay by image ID.
   */
  async getImage(connectionId: string, imageId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched image ${imageId} for connection ${connectionId}`
      );
      return {
        imageId,
        imageUrl: `https://i.ebayimg.com/images/mock/${imageId}/s-l1600.jpg`,
        status: 'UPLOADED',
        height: 1600,
        width: 1600,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).media.getImage(imageId);

      this.logger.log(
        `Fetched image ${imageId} for connection ${connectionId}`
      );

      return {
        imageId: response?.imageId || imageId,
        imageUrl: response?.imageUrl || null,
        status: response?.status || 'UNKNOWN',
        height: response?.height || null,
        width: response?.width || null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch image ${imageId} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
