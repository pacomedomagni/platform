import { Injectable, Inject, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StorageProvider,
  StorageModuleOptions,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
  UploadOptions,
  UploadResult,
  FileMetadata,
  PresignedUrlOptions,
  ListOptions,
  ListResult,
  FileAttachment,
  CreateAttachmentDto,
} from './storage.types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  /** Safe MIME types allowed for upload (STOR-3) */
  private static readonly ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    // Text
    'text/plain',
    'text/csv',
    'text/html',
    'text/xml',
    'application/json',
    // Archives
    'application/zip',
    'application/gzip',
    // Fallback
    'application/octet-stream',
  ]);

  /** Magic-byte signatures for common file types (STOR-3) */
  private static readonly MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
    { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
    { mime: 'image/bmp', bytes: [0x42, 0x4d] },
    { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
    { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
    { mime: 'application/gzip', bytes: [0x1f, 0x8b] },
  ];

  constructor(
    @Inject(STORAGE_MODULE_OPTIONS) private readonly options: StorageModuleOptions,
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
  ) {}

  /**
   * STOR-2: Sanitize a storage key to prevent path traversal attacks
   */
  private sanitizeKey(key: string): string {
    if (key.includes('..')) {
      throw new Error('Invalid storage key: path traversal ("..") is not allowed');
    }
    if (key.startsWith('/')) {
      throw new Error('Invalid storage key: absolute paths are not allowed');
    }
    if (key.includes('\0')) {
      throw new Error('Invalid storage key: null bytes are not allowed');
    }
    // Normalize path separators (backslash to forward slash)
    return key.replace(/\\/g, '/');
  }

  /**
   * Generate a unique storage key for a file
   */
  generateKey(tenantId: string, filename: string, prefix?: string): string {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);

    const parts = [tenantId];
    if (prefix) parts.push(prefix);
    parts.push(`${sanitizedBaseName}_${timestamp}_${random}${ext}`);

    return parts.join('/');
  }

  /**
   * Validate file before upload
   */
  private validateFile(data: Buffer, contentType: string): void {
    if (this.options.maxFileSizeBytes && data.length > this.options.maxFileSizeBytes) {
      throw new Error(
        `File size ${data.length} exceeds maximum allowed size of ${this.options.maxFileSizeBytes} bytes`,
      );
    }

    if (this.options.allowedMimeTypes && this.options.allowedMimeTypes.length > 0) {
      if (!this.options.allowedMimeTypes.includes(contentType)) {
        throw new Error(
          `File type ${contentType} is not allowed. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
        );
      }
    }
  }

  /**
   * STOR-3: Detect MIME type from buffer magic bytes
   */
  private detectMimeFromBuffer(data: Buffer): string | null {
    for (const sig of StorageService.MAGIC_BYTES) {
      const offset = sig.offset ?? 0;
      if (data.length < offset + sig.bytes.length) continue;
      const match = sig.bytes.every((b, i) => data[offset + i] === b);
      if (match) return sig.mime;
    }
    return null;
  }

  /**
   * STOR-3: Validate MIME type against allowlist and check for mismatches
   * between declared and detected types
   */
  private validateMimeType(data: Buffer, declaredContentType: string): void {
    // Validate declared content type against allowlist
    if (!StorageService.ALLOWED_MIME_TYPES.has(declaredContentType)) {
      throw new Error(
        `Content type "${declaredContentType}" is not in the allowed MIME types list`,
      );
    }

    // Detect actual MIME type from buffer magic bytes
    const detectedMime = this.detectMimeFromBuffer(data);
    if (detectedMime && detectedMime !== declaredContentType) {
      this.logger.warn(
        `MIME type mismatch: declared="${declaredContentType}", detected="${detectedMime}" from file magic bytes. ` +
        `The file may have been mislabeled.`,
      );
    }
  }

  /**
   * Upload a file from a buffer
   */
  async upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult> {
    key = this.sanitizeKey(key);
    const contentType = options?.contentType || 'application/octet-stream';
    this.validateFile(data, contentType);
    this.validateMimeType(data, contentType);
    return this.provider.upload(key, data, options);
  }

  /**
   * Upload a file with auto-generated key
   */
  async uploadFile(
    tenantId: string,
    filename: string,
    data: Buffer,
    options?: UploadOptions & { prefix?: string },
  ): Promise<UploadResult> {
    const key = this.generateKey(tenantId, filename, options?.prefix);
    return this.upload(key, data, options);
  }

  /**
   * Upload a file from a stream
   */
  async uploadStream(key: string, stream: Readable, options?: UploadOptions): Promise<UploadResult> {
    return this.provider.uploadStream(key, stream, options);
  }

  /**
   * Download a file as a buffer
   */
  async download(key: string): Promise<Buffer> {
    key = this.sanitizeKey(key);
    return this.provider.download(key);
  }

  /**
   * Download a file as a stream
   */
  async downloadStream(key: string): Promise<Readable> {
    return this.provider.downloadStream(key);
  }

  /**
   * Delete a file
   */
  async delete(key: string): Promise<void> {
    key = this.sanitizeKey(key);
    return this.provider.delete(key);
  }

  /**
   * Delete multiple files
   */
  async deleteMany(keys: string[]): Promise<void> {
    return this.provider.deleteMany(keys);
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    key = this.sanitizeKey(key);
    return this.provider.exists(key);
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<FileMetadata> {
    return this.provider.getMetadata(key);
  }

  /**
   * List files
   */
  async list(options?: ListOptions): Promise<ListResult> {
    return this.provider.list(options);
  }

  /**
   * Copy a file
   */
  async copy(sourceKey: string, destKey: string): Promise<UploadResult> {
    return this.provider.copy(sourceKey, destKey);
  }

  /**
   * Move a file
   */
  async move(sourceKey: string, destKey: string): Promise<UploadResult> {
    return this.provider.move(sourceKey, destKey);
  }

  /**
   * Get a presigned URL for downloading a file
   */
  async getPresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    return this.provider.getPresignedDownloadUrl(key, options);
  }

  /**
   * Get a presigned URL for uploading a file
   */
  async getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    return this.provider.getPresignedUploadUrl(key, options);
  }

  /**
   * Get the public URL for a file
   */
  getPublicUrl(key: string): string {
    return this.provider.getPublicUrl(key);
  }

  // Attachment management methods (these would typically interact with a database)

  /**
   * Create an attachment record from an upload result
   */
  createAttachmentDto(
    tenantId: string,
    doctype: string,
    docname: string,
    uploadResult: UploadResult,
    originalFilename: string,
    uploadedBy?: string,
  ): CreateAttachmentDto {
    return {
      tenantId,
      doctype,
      docname,
      filename: path.basename(uploadResult.key),
      originalFilename,
      storageKey: uploadResult.key,
      contentType: uploadResult.contentType,
      size: uploadResult.size,
      url: uploadResult.url,
      uploadedBy,
    };
  }

  /**
   * Upload and create an attachment in one operation
   */
  async uploadAttachment(
    tenantId: string,
    doctype: string,
    docname: string,
    filename: string,
    data: Buffer,
    uploadedBy?: string,
    options?: UploadOptions,
  ): Promise<CreateAttachmentDto> {
    const prefix = `attachments/${doctype}/${docname}`;
    const result = await this.uploadFile(tenantId, filename, data, { ...options, prefix });
    return this.createAttachmentDto(tenantId, doctype, docname, result, filename, uploadedBy);
  }

  /**
   * Delete attachments for a document
   */
  async deleteDocumentAttachments(attachments: FileAttachment[]): Promise<void> {
    const keys = attachments.map((a) => a.storageKey);
    await this.deleteMany(keys);
  }

  /**
   * Copy attachments from one document to another
   */
  async copyDocumentAttachments(
    sourceAttachments: FileAttachment[],
    targetTenantId: string,
    targetDoctype: string,
    targetDocname: string,
  ): Promise<CreateAttachmentDto[]> {
    const results: CreateAttachmentDto[] = [];

    for (const attachment of sourceAttachments) {
      const newKey = this.generateKey(
        targetTenantId,
        attachment.originalFilename,
        `attachments/${targetDoctype}/${targetDocname}`,
      );
      const copyResult = await this.copy(attachment.storageKey, newKey);
      results.push(
        this.createAttachmentDto(
          targetTenantId,
          targetDoctype,
          targetDocname,
          copyResult,
          attachment.originalFilename,
        ),
      );
    }

    return results;
  }
}
