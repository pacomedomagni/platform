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

  /**
   * Declared MIME types that we can fingerprint via magic bytes. Mismatches
   * for these types are rejected (not just warned). Any type we lack a magic
   * signature for is excluded so legitimate uploads of text/csv, docx, etc.
   * don't get falsely refused.
   *
   * Derived from MAGIC_BYTES at static init so the two stay in sync.
   */
  private static readonly FINGERPRINTABLE_MIME_TYPES: ReadonlySet<string> =
    new Set(StorageService.MAGIC_BYTES.map((s) => s.mime));

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
   * Phase 1 W1.3: verify `key` is within `tenantId`'s namespace.
   * Keys generated via generateKey() always start with `${tenantId}/`. An
   * attacker who knows Tenant B's key structure could otherwise pass it to
   * download() from a session authenticated as Tenant A.
   */
  private assertTenantOwnsKey(tenantId: string, key: string): void {
    if (!tenantId) {
      throw new Error('Storage access requires a tenantId');
    }
    const prefix = `${tenantId}/`;
    if (!key.startsWith(prefix)) {
      throw new Error(
        `Storage access denied: key does not belong to tenant ${tenantId}`,
      );
    }
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
  /** Default max file size: 50MB */
  private static readonly DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

  private validateMimeType(data: Buffer, declaredContentType: string): void {
    // Enforce max file size even when options.maxFileSizeBytes is not set
    const maxSize = this.options.maxFileSizeBytes || StorageService.DEFAULT_MAX_FILE_SIZE;
    if (data.length > maxSize) {
      throw new Error(
        `File size ${data.length} exceeds maximum allowed size of ${maxSize} bytes`,
      );
    }

    // Validate declared content type against allowlist
    if (!StorageService.ALLOWED_MIME_TYPES.has(declaredContentType)) {
      throw new Error(
        `Content type "${declaredContentType}" is not in the allowed MIME types list`,
      );
    }

    // Detect actual MIME type from buffer magic bytes
    const detectedMime = this.detectMimeFromBuffer(data);
    if (detectedMime && detectedMime !== declaredContentType) {
      // For declared types we have a magic-byte signature for (the
      // FINGERPRINTABLE_MIME_TYPES set), a mismatch is a hard failure: the
      // declared type is verifiable and an attacker mislabeling content as
      // image/png while serving HTML/JS to be fetched by a victim browser
      // is the canonical content-sniffing exploit. Warn-only is unsafe.
      //
      // For declared types we cannot fingerprint (text/csv, docx, etc.),
      // we keep the legacy warn-only behavior — magic bytes are absent or
      // ambiguous for those formats and rejecting based on detection of an
      // unrelated type would create false positives on legitimate uploads.
      if (StorageService.FINGERPRINTABLE_MIME_TYPES.has(declaredContentType)) {
        throw new Error(
          `MIME type mismatch: declared="${declaredContentType}", ` +
          `detected="${detectedMime}" from file magic bytes. ` +
          `Refusing upload — declared and actual content do not match.`,
        );
      }
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
   * Download a file as a buffer. `tenantId` is required so a caller from one
   * tenant cannot pass another tenant's key (W1.3).
   */
  async download(tenantId: string, key: string): Promise<Buffer> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
    return this.provider.download(key);
  }

  /**
   * Download a file as a stream (tenant-scoped, W1.3).
   */
  async downloadStream(tenantId: string, key: string): Promise<Readable> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
    return this.provider.downloadStream(key);
  }

  /**
   * Delete a single file owned by the given tenant (W1.3).
   */
  async delete(tenantId: string, key: string): Promise<void> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
    return this.provider.delete(key);
  }

  /**
   * Delete multiple files. All keys must belong to the same tenant (W1.3).
   */
  async deleteMany(tenantId: string, keys: string[]): Promise<void> {
    for (const k of keys) {
      const sanitized = this.sanitizeKey(k);
      this.assertTenantOwnsKey(tenantId, sanitized);
    }
    return this.provider.deleteMany(keys);
  }

  /**
   * Check if a file exists (tenant-scoped, W1.3).
   */
  async exists(tenantId: string, key: string): Promise<boolean> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
    return this.provider.exists(key);
  }

  /**
   * Get file metadata (tenant-scoped, W1.3).
   */
  async getMetadata(tenantId: string, key: string): Promise<FileMetadata> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
    return this.provider.getMetadata(key);
  }

  /**
   * List files (tenant-scoped, W1.3). Any `prefix` option is automatically
   * prepended with the tenant namespace so one tenant cannot enumerate another.
   */
  async list(tenantId: string, options?: ListOptions): Promise<ListResult> {
    if (!tenantId) throw new Error('Storage list requires a tenantId');
    const prefix = options?.prefix
      ? `${tenantId}/${options.prefix.replace(/^\/+/, '')}`
      : `${tenantId}/`;
    return this.provider.list({ ...options, prefix });
  }

  /**
   * Copy a file within one tenant's namespace (W1.3).
   */
  async copy(tenantId: string, sourceKey: string, destKey: string): Promise<UploadResult> {
    const src = this.sanitizeKey(sourceKey);
    const dst = this.sanitizeKey(destKey);
    this.assertTenantOwnsKey(tenantId, src);
    this.assertTenantOwnsKey(tenantId, dst);
    return this.provider.copy(src, dst);
  }

  /**
   * Move a file within one tenant's namespace (W1.3).
   */
  async move(tenantId: string, sourceKey: string, destKey: string): Promise<UploadResult> {
    const src = this.sanitizeKey(sourceKey);
    const dst = this.sanitizeKey(destKey);
    this.assertTenantOwnsKey(tenantId, src);
    this.assertTenantOwnsKey(tenantId, dst);
    return this.provider.move(src, dst);
  }

  /**
   * Get a presigned URL for downloading a file (tenant-scoped, W1.3).
   */
  async getPresignedDownloadUrl(
    tenantId: string,
    key: string,
    options?: PresignedUrlOptions,
  ): Promise<string> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
    return this.provider.getPresignedDownloadUrl(key, options);
  }

  /**
   * Get a presigned URL for uploading a file (tenant-scoped, W1.3).
   */
  async getPresignedUploadUrl(
    tenantId: string,
    key: string,
    options?: PresignedUrlOptions,
  ): Promise<string> {
    key = this.sanitizeKey(key);
    this.assertTenantOwnsKey(tenantId, key);
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
   * Delete attachments for a document. All attachments must belong to the
   * same tenant (W1.3).
   */
  async deleteDocumentAttachments(tenantId: string, attachments: FileAttachment[]): Promise<void> {
    const keys = attachments.map((a) => a.storageKey);
    await this.deleteMany(tenantId, keys);
  }

  /**
   * Copy attachments from one document to another within the same tenant's
   * namespace. Source keys must belong to targetTenantId (W1.3).
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
      const copyResult = await this.copy(targetTenantId, attachment.storageKey, newKey);
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
