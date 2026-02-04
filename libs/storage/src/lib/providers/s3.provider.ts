import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import * as mimeTypes from 'mime-types';
import {
  StorageProvider,
  S3ProviderOptions,
  UploadOptions,
  UploadResult,
  FileMetadata,
  PresignedUrlOptions,
  ListOptions,
  ListResult,
} from '../storage.types';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint?: string;

  constructor(private readonly options: S3ProviderOptions) {
    this.bucket = options.bucket;
    this.endpoint = options.endpoint;

    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? !!options.endpoint,
      credentials: options.accessKeyId && options.secretAccessKey
        ? {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          }
        : undefined,
    });

    this.logger.log(`S3 provider initialized for bucket: ${this.bucket}`);
  }

  async upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult> {
    const contentType = options?.contentType || mimeTypes.lookup(key) || 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      Metadata: options?.metadata,
      ACL: options?.acl,
      CacheControl: options?.cacheControl,
    });

    const result = await this.client.send(command);

    return {
      key,
      url: this.getPublicUrl(key),
      size: data.length,
      contentType,
      etag: result.ETag?.replace(/"/g, ''),
    };
  }

  async uploadStream(key: string, stream: Readable, options?: UploadOptions): Promise<UploadResult> {
    // For streams, we need to collect the data first
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    return this.upload(key, data, options);
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    const stream = response.Body as Readable;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async downloadStream(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    return response.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    this.logger.debug(`Deleted file: ${key}`);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
      },
    });

    await this.client.send(command);
    this.logger.debug(`Deleted ${keys.length} files`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getMetadata(key);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    return {
      key,
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
      etag: response.ETag?.replace(/"/g, ''),
      metadata: response.Metadata,
    };
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: options?.prefix,
      MaxKeys: options?.maxKeys || 1000,
      ContinuationToken: options?.continuationToken,
    });

    const response = await this.client.send(command);

    const files: FileMetadata[] = (response.Contents || []).map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      contentType: mimeTypes.lookup(item.Key || '') || 'application/octet-stream',
      lastModified: item.LastModified || new Date(),
      etag: item.ETag?.replace(/"/g, ''),
    }));

    return {
      files,
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated || false,
    };
  }

  async copy(sourceKey: string, destKey: string): Promise<UploadResult> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destKey,
    });

    const result = await this.client.send(command);
    const metadata = await this.getMetadata(destKey);

    return {
      key: destKey,
      url: this.getPublicUrl(destKey),
      size: metadata.size,
      contentType: metadata.contentType,
      etag: result.CopyObjectResult?.ETag?.replace(/"/g, ''),
    };
  }

  async move(sourceKey: string, destKey: string): Promise<UploadResult> {
    const result = await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
    return result;
  }

  async getPresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options?.contentDisposition,
      ResponseContentType: options?.contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn || 3600,
    });
  }

  async getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options?.contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn || 3600,
    });
  }

  getPublicUrl(key: string): string {
    if (this.endpoint) {
      // MinIO or custom endpoint
      return `${this.endpoint}/${this.bucket}/${key}`;
    }
    // Standard S3
    return `https://${this.bucket}.s3.${this.options.region}.amazonaws.com/${key}`;
  }
}
