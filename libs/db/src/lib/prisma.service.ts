import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool, PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';
import { buildTenantRlsExtension } from './tenant-rls-extension';

// Pool configuration with sensible defaults for production
const DEFAULT_POOL_CONFIG: Partial<PoolConfig> = {
  max: parseInt(process.env['DB_POOL_MAX'] || '20', 10),
  min: parseInt(process.env['DB_POOL_MIN'] || '2', 10),
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '10000', 10),
  statement_timeout: parseInt(process.env['DB_STATEMENT_TIMEOUT'] || '60000', 10),
};

/**
 * PrismaService — applies a `$extends` tenant-RLS interceptor on top of the
 * raw PrismaClient. Every query against a tenant-scoped model is auto-wrapped
 * in a `$transaction` that first issues `set_config('app.tenant', X, true)`
 * so Postgres RLS policies see the right tenant. Cross-tenant ops can wrap
 * their callers in `bypassTenantGuard()` to skip the auto-wrap.
 *
 * Implementation note: this class composes (rather than extends)
 * `PrismaClient`. The previous shape did `extends PrismaClient` plus
 * `Object.setPrototypeOf(this, extendedClient)` to splice the extension
 * into the runtime prototype chain. That worked under Prisma 5/6 because
 * model accessors were owned properties on the client instance. Prisma 7
 * resolves model accessors via lazy proxies whose lookup re-enters the
 * prototype chain — and `Object.setPrototypeOf(this, extended)` makes
 * the chain self-referential, so every model access infinite-recurses
 * with a `Maximum call stack size exceeded`.
 *
 * Composition + a `Proxy` keeps the public type (callers still see a
 * `PrismaClient`-shaped surface) while routing every read through the
 * extended client. PrismaService-specific methods like `getPoolStats()`
 * and the lifecycle hooks live on the wrapper itself; everything else
 * forwards.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly client: PrismaClient;
  // Type assertion through `unknown`: the extended client's type is
  // anonymous (Prisma derives it at compile time from the extension
  // shape) but its runtime surface is a strict superset of PrismaClient
  // — every method we forward is present.
  private readonly extended: PrismaClient;

  constructor(private readonly cls: ClsService) {
    const connectionString = process.env['APP_DATABASE_URL'] || process.env['DATABASE_URL'];

    if (!connectionString) {
      throw new Error('Database connection string not configured. Set APP_DATABASE_URL or DATABASE_URL environment variable.');
    }

    const poolConfig: PoolConfig = {
      connectionString,
      ...DEFAULT_POOL_CONFIG,
    };

    const pool = new Pool(poolConfig);
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    const adapter = new PrismaPg(pool);
    this.client = new PrismaClient({ adapter });
    this.pool = pool;

    this.extended = this.client.$extends(
      buildTenantRlsExtension({
        getTenantId: () => {
          try {
            return this.cls.get('tenantId');
          } catch {
            return undefined;
          }
        },
      }),
    ) as unknown as PrismaClient;

    // Proxy `this` so callers reading e.g. `prismaService.user.findMany`
    // hit the extended client's `user`, while lifecycle methods and
    // wrapper-only helpers (getPoolStats, onModuleInit, etc.) still
    // resolve to this instance. We return the proxy from the
    // constructor — Nest sees the proxy as the provider instance.
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // Wrapper-owned properties win. Reflect.has walks the prototype
        // so methods defined on PrismaService (onModuleInit, etc.) are
        // included alongside instance fields. Symbols are also handled
        // here because Reflect.has supports them.
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }
        // Everything else (model accessors, $transaction, $queryRaw,
        // $executeRaw, $connect, $disconnect, $on, $extends, $use, …)
        // forwards to the extended client. We bind functions to the
        // extended client so `this` inside them is correct.
        const value = Reflect.get(this.extended as object, prop);
        return typeof value === 'function' ? value.bind(this.extended) : value;
      },
      // The Proxy must report properties from both surfaces correctly so
      // tools that walk the object (e.g. Nest's metadata reflection,
      // some logger libraries) don't trip.
      has: (target, prop) => {
        return Reflect.has(target, prop) || Reflect.has(this.extended as object, prop);
      },
    });
  }

  async onModuleInit() {
    await this.client.$connect();
    this.logger.log(`Database pool initialized (max: ${DEFAULT_POOL_CONFIG.max}, min: ${DEFAULT_POOL_CONFIG.min})`);
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
    this.logger.log('Database pool closed');
  }

  /**
   * Get current pool statistics for monitoring
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

// Public type assertion: callers that import PrismaService get the full
// PrismaClient surface plus PrismaService-specific helpers. The runtime
// Proxy above implements both.
export interface PrismaService extends PrismaClient {}
