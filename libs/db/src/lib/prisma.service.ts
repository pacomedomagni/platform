import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool, PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Pool configuration with sensible defaults for production
const DEFAULT_POOL_CONFIG: Partial<PoolConfig> = {
  // Maximum number of clients in the pool
  max: parseInt(process.env['DB_POOL_MAX'] || '20', 10),
  // Minimum number of clients to keep in the pool
  min: parseInt(process.env['DB_POOL_MIN'] || '2', 10),
  // Close idle clients after this many milliseconds (30 seconds)
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000', 10),
  // Return an error after this many milliseconds if connection cannot be established (10 seconds)
  connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '10000', 10),
  // Maximum time a query can run before being cancelled (60 seconds)
  statement_timeout: parseInt(process.env['DB_STATEMENT_TIMEOUT'] || '60000', 10),
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    const connectionString = process.env['APP_DATABASE_URL'] || process.env['DATABASE_URL'];
    
    if (!connectionString) {
      throw new Error('Database connection string not configured. Set APP_DATABASE_URL or DATABASE_URL environment variable.');
    }

    const poolConfig: PoolConfig = {
      connectionString,
      ...DEFAULT_POOL_CONFIG,
    };

    const pool = new Pool(poolConfig);
    
    // Handle pool errors to prevent unhandled rejections
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    pool.on('connect', () => {
      // Connection established - can add logging here if needed
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(`Database pool initialized (max: ${DEFAULT_POOL_CONFIG.max}, min: ${DEFAULT_POOL_CONFIG.min})`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
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
