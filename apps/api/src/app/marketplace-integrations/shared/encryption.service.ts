import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Encryption service for sensitive data (OAuth tokens, API keys)
 * Uses AES-256-GCM encryption
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 64;

  /**
   * Get encryption key from environment, derived with the given salt
   */
  private getKey(salt: Buffer): Buffer {
    const secret = process.env['ENCRYPTION_KEY'] || process.env['JWT_SECRET'] || 'default-dev-key-change-in-production';

    if (process.env.NODE_ENV === 'production' && secret === 'default-dev-key-change-in-production') {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }

    // Derive a key using scrypt with per-encryption random salt
    return scryptSync(secret, salt, this.keyLength);
  }

  /**
   * Encrypt a string value
   * Returns base64-encoded encrypted data with IV and auth tag
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';

    const salt = randomBytes(this.saltLength);
    const key = this.getKey(salt);
    const iv = randomBytes(this.ivLength);

    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine salt + IV + encrypted + tag, then base64 encode
    const combined = Buffer.concat([salt, iv, Buffer.from(encrypted, 'hex'), tag]);
    return combined.toString('base64');
  }

  /**
   * Decrypt an encrypted string
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) return '';

    try {
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract salt, IV, encrypted data, and auth tag
      const salt = combined.slice(0, this.saltLength);
      const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
      const tag = combined.slice(-this.tagLength);
      const encrypted = combined.slice(this.saltLength + this.ivLength, -this.tagLength);

      const key = this.getKey(salt);

      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}
