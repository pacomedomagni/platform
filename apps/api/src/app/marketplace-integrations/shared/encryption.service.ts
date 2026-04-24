import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Encryption service for sensitive data (OAuth tokens, API keys).
 * AES-256-GCM with a master secret derived per-ciphertext via scrypt + salt.
 *
 * Ciphertext layout (base64-encoded):
 *   [salt(64)] [iv(16)] [ciphertext(n)] [tag(16)]
 *
 * Phase 1 W1.4: introduces rotation support via an optional fallback key.
 * Setting `ENCRYPTION_KEY_PREVIOUS` lets the service decrypt data encrypted
 * with the prior key while new writes use the current `ENCRYPTION_KEY`. Phase
 * 2 will add a re-encrypt sweep that clears `_PREVIOUS` once complete.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 64;

  /**
   * Resolve the set of candidate master secrets.
   * Index 0 is the current key (used for encryption and tried first on decrypt);
   * subsequent entries are legacy keys only consulted on decrypt.
   */
  private getKeyCandidates(): string[] {
    const primary = process.env['ENCRYPTION_KEY'] || process.env['JWT_SECRET'];
    if (!primary) {
      throw new Error(
        'ENCRYPTION_KEY is required for encryption/decryption. ' +
        'Dev/test may set JWT_SECRET instead. Production enforces this at boot.'
      );
    }
    const fallback = process.env['ENCRYPTION_KEY_PREVIOUS'];
    return fallback && fallback !== primary ? [primary, fallback] : [primary];
  }

  private deriveKey(secret: string, salt: Buffer): Buffer {
    return scryptSync(secret, salt, this.keyLength);
  }

  /**
   * Encrypt a string value. Returns base64-encoded ciphertext with salt, IV,
   * and GCM auth tag packed in. Always uses the current primary key.
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';

    const [primarySecret] = this.getKeyCandidates();
    const salt = randomBytes(this.saltLength);
    const iv = randomBytes(this.ivLength);
    const key = this.deriveKey(primarySecret, salt);

    const cipher = createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([salt, iv, Buffer.from(encrypted, 'hex'), tag]);
    return combined.toString('base64');
  }

  /**
   * Decrypt. Tries the current key first; if it fails (most commonly because
   * the data was written with a prior key), tries each fallback in turn. GCM
   * auth-tag verification means a wrong-key attempt fails loudly rather than
   * silently returning garbage, so iterating is safe.
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) return '';
    const combined = Buffer.from(encryptedData, 'base64');
    const salt = combined.slice(0, this.saltLength);
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
    const tag = combined.slice(-this.tagLength);
    const encrypted = combined.slice(this.saltLength + this.ivLength, -this.tagLength);

    const candidates = this.getKeyCandidates();
    let lastError: Error | null = null;
    for (const secret of candidates) {
      try {
        const key = this.deriveKey(secret, salt);
        const decipher = createCipheriv === createCipheriv ? createDecipheriv(this.algorithm, key, iv) : null;
        if (!decipher) throw new Error('createDecipheriv unavailable');
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw new Error(
      `Decryption failed (tried ${candidates.length} key candidate(s)): ${lastError?.message ?? 'unknown'}`,
    );
  }
}
