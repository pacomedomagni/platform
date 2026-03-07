import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Distributed Lock Service
 * Provides Redis-based distributed locks to prevent concurrent sync jobs
 * across multiple application instances.
 *
 * Uses Redis SET NX EX for atomic lock acquisition with automatic expiry.
 */
@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private redis: Redis | null = null;
  private readonly LOCK_PREFIX = 'noslag:lock:';

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.redis.on('error', (err) => {
        this.logger.warn(`Redis lock connection error: ${err.message}`);
      });
    }
    return this.redis;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  /**
   * Acquire a distributed lock.
   * @param key - Lock name (e.g. 'ebay:order-sync:connection-123')
   * @param ttlSeconds - Lock expiry in seconds (auto-release if holder crashes)
   * @returns true if lock was acquired, false if already held
   */
  async acquire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const redis = this.getRedis();
      const lockKey = `${this.LOCK_PREFIX}${key}`;
      const result = await redis.set(lockKey, Date.now().toString(), 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      // If Redis is unavailable, fall through (allow sync to proceed)
      this.logger.warn(`Failed to acquire lock ${key}: ${error?.message}. Proceeding without lock.`);
      return true;
    }
  }

  /**
   * Release a distributed lock.
   */
  async release(key: string): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.del(`${this.LOCK_PREFIX}${key}`);
    } catch (error) {
      this.logger.warn(`Failed to release lock ${key}: ${error?.message}`);
    }
  }

  /**
   * Execute a function while holding a distributed lock.
   * If the lock cannot be acquired, returns null without executing.
   */
  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire(key, ttlSeconds);
    if (!acquired) {
      this.logger.debug(`Lock ${key} already held, skipping`);
      return null;
    }
    try {
      return await fn();
    } finally {
      await this.release(key);
    }
  }
}
