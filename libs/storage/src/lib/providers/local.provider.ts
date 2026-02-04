import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import * as mimeTypes from 'mime-types';
import * as crypto from 'crypto';
import {
  StorageProvider,
  LocalProviderOptions,
  UploadOptions,
  UploadResult,
  FileMetadata,
  PresignedUrlOptions,
  ListOptions,
  ListResult,
} from '../storage.types';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(private readonly options: LocalProviderOptions) {
    this.basePath = options.basePath;
    this.baseUrl = options.baseUrl || '/files';
    this.ensureDirectoryExists(this.basePath);
    this.logger.log(`Local storage provider initialized at: ${this.basePath}`);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory exists or creation failed
    }
  }

  private getFullPath(key: string): string {
    return path.join(this.basePath, key);
  }

  private computeEtag(data: Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult> {
    const fullPath = this.getFullPath(key);
    const dir = path.dirname(fullPath);

    await this.ensureDirectoryExists(dir);
    await fs.writeFile(fullPath, data);

    const contentType = options?.contentType || mimeTypes.lookup(key) || 'application/octet-stream';

    // Store metadata in a sidecar file
    if (options?.metadata) {
      const metaPath = `${fullPath}.meta.json`;
      await fs.writeFile(metaPath, JSON.stringify({
        contentType,
        metadata: options.metadata,
      }));
    }

    return {
      key,
      url: this.getPublicUrl(key),
      size: data.length,
      contentType,
      etag: this.computeEtag(data),
    };
  }

  async uploadStream(key: string, stream: Readable, options?: UploadOptions): Promise<UploadResult> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    return this.upload(key, data, options);
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return fs.readFile(fullPath);
  }

  async downloadStream(key: string): Promise<Readable> {
    const fullPath = this.getFullPath(key);
    return fsSync.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    const metaPath = `${fullPath}.meta.json`;

    try {
      await fs.unlink(fullPath);
    } catch {
      // File doesn't exist
    }

    try {
      await fs.unlink(metaPath);
    } catch {
      // Meta file doesn't exist
    }

    this.logger.debug(`Deleted file: ${key}`);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const fullPath = this.getFullPath(key);
    const stats = await fs.stat(fullPath);

    let contentType = mimeTypes.lookup(key) || 'application/octet-stream';
    let metadata: Record<string, string> | undefined;

    // Try to read sidecar metadata
    try {
      const metaPath = `${fullPath}.meta.json`;
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      contentType = meta.contentType || contentType;
      metadata = meta.metadata;
    } catch {
      // No metadata file
    }

    const data = await fs.readFile(fullPath);

    return {
      key,
      size: stats.size,
      contentType,
      lastModified: stats.mtime,
      etag: this.computeEtag(data),
      metadata,
    };
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix || '';
    const searchPath = this.getFullPath(prefix);
    const maxKeys = options?.maxKeys || 1000;

    const files: FileMetadata[] = [];

    async function* walkDir(dir: string): AsyncGenerator<string> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            yield* walkDir(fullPath);
          } else if (!entry.name.endsWith('.meta.json')) {
            yield fullPath;
          }
        }
      } catch {
        // Directory doesn't exist or not accessible
      }
    }

    let count = 0;
    for await (const filePath of walkDir(searchPath.endsWith('/') ? searchPath : path.dirname(searchPath))) {
      if (count >= maxKeys) break;

      const relativePath = path.relative(this.basePath, filePath);
      if (relativePath.startsWith(prefix.replace(/^\//, ''))) {
        try {
          const stats = await fs.stat(filePath);
          files.push({
            key: relativePath,
            size: stats.size,
            contentType: mimeTypes.lookup(filePath) || 'application/octet-stream',
            lastModified: stats.mtime,
          });
          count++;
        } catch {
          // Skip files we can't read
        }
      }
    }

    return {
      files,
      isTruncated: false, // Simplified - not implementing pagination for local
    };
  }

  async copy(sourceKey: string, destKey: string): Promise<UploadResult> {
    const sourcePath = this.getFullPath(sourceKey);
    const destPath = this.getFullPath(destKey);

    await this.ensureDirectoryExists(path.dirname(destPath));
    await fs.copyFile(sourcePath, destPath);

    // Copy metadata if exists
    try {
      await fs.copyFile(`${sourcePath}.meta.json`, `${destPath}.meta.json`);
    } catch {
      // No metadata file
    }

    const metadata = await this.getMetadata(destKey);

    return {
      key: destKey,
      url: this.getPublicUrl(destKey),
      size: metadata.size,
      contentType: metadata.contentType,
      etag: metadata.etag,
    };
  }

  async move(sourceKey: string, destKey: string): Promise<UploadResult> {
    const result = await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
    return result;
  }

  async getPresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    // For local storage, we can't really do presigned URLs
    // Return the public URL with an optional expiry parameter that the server should validate
    const expiry = Math.floor(Date.now() / 1000) + (options?.expiresIn || 3600);
    const signature = crypto
      .createHmac('sha256', process.env['LOCAL_STORAGE_SECRET'] || 'default-secret')
      .update(`${key}:${expiry}`)
      .digest('hex');

    return `${this.baseUrl}/${key}?expires=${expiry}&signature=${signature}`;
  }

  async getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    // Similar to download, create a signed URL
    const expiry = Math.floor(Date.now() / 1000) + (options?.expiresIn || 3600);
    const signature = crypto
      .createHmac('sha256', process.env['LOCAL_STORAGE_SECRET'] || 'default-secret')
      .update(`upload:${key}:${expiry}`)
      .digest('hex');

    return `${this.baseUrl}/upload/${key}?expires=${expiry}&signature=${signature}`;
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
