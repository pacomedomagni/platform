import { Readable } from 'stream';

export const STORAGE_MODULE_OPTIONS = 'STORAGE_MODULE_OPTIONS';
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export type StorageProviderType = 's3' | 'local';

export interface S3ProviderOptions {
  type: 's3';
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For MinIO or other S3-compatible services
  forcePathStyle?: boolean; // Required for MinIO
}

export interface LocalProviderOptions {
  type: 'local';
  basePath: string;
  baseUrl?: string; // URL prefix for serving files
}

export type StorageProviderOptions = S3ProviderOptions | LocalProviderOptions;

export interface StorageModuleOptions {
  provider: StorageProviderOptions;
  maxFileSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
  cacheControl?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag?: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds
  contentType?: string;
  contentDisposition?: string;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  files: FileMetadata[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface StorageProvider {
  /**
   * Upload a file from a buffer
   */
  upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Upload a file from a stream
   */
  uploadStream(key: string, stream: Readable, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file as a buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Download a file as a stream
   */
  downloadStream(key: string): Promise<Readable>;

  /**
   * Delete a file
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple files
   */
  deleteMany(keys: string[]): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(key: string): Promise<FileMetadata>;

  /**
   * List files with optional prefix
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * Copy a file to a new key
   */
  copy(sourceKey: string, destKey: string): Promise<UploadResult>;

  /**
   * Move a file to a new key
   */
  move(sourceKey: string, destKey: string): Promise<UploadResult>;

  /**
   * Generate a presigned URL for download
   */
  getPresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;

  /**
   * Generate a presigned URL for upload
   */
  getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;

  /**
   * Get the public URL for a file (if public access is enabled)
   */
  getPublicUrl(key: string): string;
}

// Attachment types for linking files to documents
export interface FileAttachment {
  id: string;
  tenantId: string;
  doctype: string;
  docname: string;
  filename: string;
  originalFilename: string;
  storageKey: string;
  contentType: string;
  size: number;
  url: string;
  metadata?: Record<string, string>;
  uploadedBy?: string;
  createdAt: Date;
}

export interface CreateAttachmentDto {
  tenantId: string;
  doctype: string;
  docname: string;
  filename: string;
  originalFilename: string;
  storageKey: string;
  contentType: string;
  size: number;
  url: string;
  metadata?: Record<string, string>;
  uploadedBy?: string;
}
