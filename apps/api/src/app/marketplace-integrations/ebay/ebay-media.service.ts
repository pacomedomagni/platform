import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StorageService } from '@platform/storage';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';

/**
 * eBay Media Service
 * Manages image and video uploads via the eBay Commerce Media API.
 * All media is sourced from MinIO (via StorageService) and uploaded to eBay.
 *
 * Image flow: MinIO → download buffer → uploadImageFromFile → EPS URL (i.ebayimg.com)
 * Video flow: MinIO → download buffer → createVideo → chunked upload → videoId
 */
@Injectable()
export class EbayMediaService {
  private readonly logger = new Logger(EbayMediaService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService,
    private storage: StorageService
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

  // ============================================
  // Storage-Based Uploads (MinIO → eBay)
  // ============================================

  /**
   * Extract storage key from a MinIO/S3 URL.
   * MinIO URLs follow: ${endpoint}/${bucket}/${key}
   * S3 URLs follow: https://${bucket}.s3.${region}.amazonaws.com/${key}
   * Falls back to using the URL as-is if extraction fails.
   */
  extractStorageKey(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      // For MinIO path-style: /bucket/tenant/prefix/file → remove bucket (first segment)
      if (pathParts.length >= 2) {
        return pathParts.slice(1).join('/');
      }
      return pathParts.join('/');
    } catch {
      // Not a valid URL - assume it's already a storage key
      return url;
    }
  }

  /**
   * Upload an image to eBay EPS from MinIO storage.
   * Downloads the image buffer from MinIO, then uploads as binary to eBay.
   * This avoids the problem of eBay not being able to reach internal MinIO URLs.
   */
  async uploadImageFromStorage(
    connectionId: string,
    imageUrlOrKey: string
  ): Promise<{ imageId: string; imageUrl: string }> {
    const storageKey = this.extractStorageKey(imageUrlOrKey);

    if (this.mockMode) {
      const mockImageId = `mock_image_storage_${Date.now()}`;
      this.logger.log(
        `[MOCK] Uploaded image from storage for connection ${connectionId}: ${storageKey} (${mockImageId})`
      );
      return {
        imageId: mockImageId,
        imageUrl: `https://i.ebayimg.com/images/mock/${mockImageId}/s-l1600.jpg`,
      };
    }

    try {
      // Resolve tenantId from the connection so the storage access check
      // (W1.3) can verify the key is within the caller's namespace.
      const connection = await this.prisma.marketplaceConnection.findUniqueOrThrow({
        where: { id: connectionId },
        select: { tenantId: true },
      });

      // Download image buffer from MinIO
      const buffer = await this.storage.download(connection.tenantId, storageKey);

      // Determine content type from file extension
      const contentType = this.getContentTypeFromKey(storageKey);

      // Upload binary to eBay EPS
      const result = await this.uploadImageFromFile(connectionId, buffer, contentType);

      this.logger.log(
        `Uploaded image from storage for connection ${connectionId}: ${storageKey} → ${result.imageId}`
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to upload image from storage for connection ${connectionId}: ${storageKey}`,
        error
      );
      throw error;
    }
  }

  /**
   * Upload a video to eBay from MinIO storage.
   * Downloads the video buffer from MinIO, creates a video entry on eBay,
   * then uploads the binary to the eBay upload URL.
   */
  async uploadVideoFromStorage(
    connectionId: string,
    videoUrlOrKey: string,
    title: string,
    description?: string
  ): Promise<{ videoId: string; status: string }> {
    const storageKey = this.extractStorageKey(videoUrlOrKey);

    if (this.mockMode) {
      const mockVideoId = `mock_video_storage_${Date.now()}`;
      this.logger.log(
        `[MOCK] Uploaded video from storage for connection ${connectionId}: ${storageKey} (${mockVideoId})`
      );
      return { videoId: mockVideoId, status: 'PROCESSING' };
    }

    try {
      // Resolve tenantId for the W1.3 storage ownership check.
      const connection = await this.prisma.marketplaceConnection.findUniqueOrThrow({
        where: { id: connectionId },
        select: { tenantId: true },
      });

      // Step 1: Download video buffer from MinIO
      const buffer = await this.storage.download(connection.tenantId, storageKey);
      this.logger.log(`Downloaded video from storage: ${storageKey} (${buffer.length} bytes)`);

      // Step 2: Create video entry on eBay to get upload URL
      const { videoId, uploadUrl } = await this.createVideo(connectionId, title, description);

      // Step 3: Upload video binary to eBay's upload URL with retry
      const client = await this.ebayStore.getClient(connectionId);
      const accessToken = this.ebayClient.getAccessToken(client);

      const contentType = this.getContentTypeFromKey(storageKey) || 'video/mp4';
      await this.uploadVideoWithRetry(uploadUrl, accessToken, contentType, buffer);

      this.logger.log(
        `Uploaded video from storage for connection ${connectionId}: ${storageKey} → ${videoId}`
      );

      return { videoId, status: 'PROCESSING' };
    } catch (error) {
      this.logger.error(
        `Failed to upload video from storage for connection ${connectionId}: ${storageKey}`,
        error
      );
      throw error;
    }
  }

  /**
   * Upload video binary to eBay's upload URL with retry and exponential backoff.
   * Retries up to 3 times on transient failures (network errors, 5xx, 429).
   */
  private async uploadVideoWithRetry(
    uploadUrl: string,
    accessToken: string,
    contentType: string,
    buffer: Buffer,
    maxRetries = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': contentType,
            'Content-Length': buffer.length.toString(),
            'Content-Range': `bytes 0-${buffer.length - 1}/${buffer.length}`,
          },
          body: new Uint8Array(buffer),
        });

        if (response.ok || response.status === 200 || response.status === 201) {
          return;
        }

        // Retry on 429 (rate limit) or 5xx (server errors)
        const isRetryable = response.status === 429 || response.status >= 500;
        if (isRetryable && attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.warn(
            `Video upload attempt ${attempt}/${maxRetries} failed with ${response.status}, retrying in ${backoffMs}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw new Error(
          `eBay video upload failed with status ${response.status}: ${response.statusText}`
        );
      } catch (error) {
        // Retry on network-level errors (fetch failures)
        if (attempt < maxRetries && !(error instanceof Error && error.message.includes('eBay video upload failed'))) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.warn(
            `Video upload attempt ${attempt}/${maxRetries} failed with network error, retrying in ${backoffMs}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Determine MIME content type from a storage key or filename.
   */
  private getContentTypeFromKey(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      webm: 'video/webm',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
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
