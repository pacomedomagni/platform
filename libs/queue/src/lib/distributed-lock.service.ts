import { Injectable, Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import {
  QueueModuleOptions,
  QUEUE_MODULE_OPTIONS,
} from './queue.types';

/**
 * Phase 3 W3.2: Redis-backed distributed lock.
 *
 * Used by `@DistributedCron` (and any cron decorator wrapper) so that
 * @Cron handlers fire on exactly one API pod per interval. Without this,
 * every pod runs the same cron simultaneously — cart cleanup runs Nx,
 * password-reset cleanup runs Nx, the failed-operations retry queue is
 * polled Nx, etc. Most of these are not idempotent at the per-cron level
 * and produce duplicate side effects under multi-pod deploys.
 *
 * Implementation: SET key value NX EX ttl (atomic acquire). Lock value
 * is a unique token so we can release only if we still own it (compare-
 * and-delete via Lua to avoid releasing a lock another pod just took).
 *
 * For long jobs, callers can supply a heartbeat callback; the service
 * extends the TTL while the job is running.
 */
@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redis: IORedis;

  constructor(
    @Inject(QUEUE_MODULE_OPTIONS) private readonly options: QueueModuleOptions,
  ) {
    this.redis = new IORedis({
      host: this.options.connection.host,
      port: this.options.connection.port,
      password: this.options.connection.password,
      // ioredis may try to reconnect forever; bound it.
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.redis.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      // Already closed
    }
  }

  /**
   * Try to acquire `lockKey` for `ttlMs`. Returns the lock token on success
   * or `null` if another holder owns the lock.
   */
  async tryAcquire(lockKey: string, ttlMs: number): Promise<string | null> {
    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * Release `lockKey` only if we still own it (token matches). Uses a Lua
   * script so the check-and-delete is atomic — without it, a pod could
   * release a lock another pod just acquired after this pod's TTL
   * expired.
   */
  async release(lockKey: string, token: string): Promise<boolean> {
    const lua = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;
    const result = (await this.redis.eval(lua, 1, lockKey, token)) as number;
    return result === 1;
  }

  /**
   * Run `fn` with `lockKey` held. If the lock cannot be acquired (another
   * pod already holds it) the function is skipped and `null` is returned —
   * this is the desired behaviour for `@Cron` jobs.
   *
   * Long-running fn: pass `extendEveryMs` < `ttlMs` and the service will
   * periodically extend the lock TTL while fn runs, so a slow job does not
   * lose its lock prematurely.
   */
  async withLock<T>(
    lockKey: string,
    ttlMs: number,
    fn: () => Promise<T>,
    options?: { extendEveryMs?: number },
  ): Promise<T | null> {
    const token = await this.tryAcquire(lockKey, ttlMs);
    if (!token) {
      this.logger.debug(`Lock ${lockKey} held by another instance — skipping`);
      return null;
    }

    let extendTimer: NodeJS.Timeout | null = null;
    if (options?.extendEveryMs && options.extendEveryMs < ttlMs) {
      extendTimer = setInterval(async () => {
        try {
          // Lua: only extend if we still own it.
          const lua = `
            if redis.call('GET', KEYS[1]) == ARGV[1] then
              return redis.call('PEXPIRE', KEYS[1], ARGV[2])
            else
              return 0
            end
          `;
          await this.redis.eval(lua, 1, lockKey, token, ttlMs.toString());
        } catch (err) {
          this.logger.warn(
            `Failed to extend lock ${lockKey}: ${(err as Error).message}`,
          );
        }
      }, options.extendEveryMs);
    }

    try {
      return await fn();
    } finally {
      if (extendTimer) clearInterval(extendTimer);
      await this.release(lockKey, token).catch((err) => {
        this.logger.warn(
          `Failed to release lock ${lockKey}: ${(err as Error).message}`,
        );
      });
    }
  }
}
