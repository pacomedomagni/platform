import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import Redis from 'ioredis';

const CACHE_PREFIX = 'domain:';
const CACHE_TTL = 300; // 5 minutes

export interface ResolvedTenant {
  tenantId: string;
  type: 'subdomain' | 'custom_domain';
}

@Injectable()
export class DomainResolverService implements OnModuleDestroy {
  private readonly logger = new Logger(DomainResolverService.name);
  private readonly redis: Redis;
  private readonly platformDomain: string;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      password: process.env['REDIS_PASSWORD'],
    });

    // M-1: Add error handler to prevent unhandled connection errors from crashing the process
    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.platformDomain = process.env['DOMAIN'] || 'noslag.com';
  }

  async onModuleDestroy() {
    await this.redis.disconnect();
  }

  /**
   * Resolve a hostname to a tenant UUID.
   * Handles both subdomains (store1.noslag.com) and custom domains (mybrand.com).
   */
  async resolve(hostname: string): Promise<ResolvedTenant | null> {
    if (!hostname) return null;

    const normalized = hostname.toLowerCase().split(':')[0]; // strip port

    // Check cache first
    const cached = await this.redis.get(`${CACHE_PREFIX}${normalized}`);
    if (cached !== null) {
      // M-TP-6: Empty string is the sentinel for negative cache (domain not found).
      // Non-empty strings are valid JSON payloads.
      if (cached === '') return null;
      return JSON.parse(cached);
    }

    let result: ResolvedTenant | null = null;

    // Check if it's a platform subdomain (e.g., store1.noslag.com)
    if (normalized.endsWith(`.${this.platformDomain}`)) {
      const subdomain = normalized.replace(`.${this.platformDomain}`, '');
      if (subdomain && !subdomain.includes('.')) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { domain: subdomain },
          select: { id: true, isActive: true },
        });
        if (tenant?.isActive) {
          result = { tenantId: tenant.id, type: 'subdomain' };
        }
      }
    } else {
      // Check custom domain
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          customDomain: normalized,
          customDomainStatus: 'verified',
          isActive: true,
        },
        select: { id: true },
      });
      if (tenant) {
        result = { tenantId: tenant.id, type: 'custom_domain' };
      }
    }

    // Cache the result (even negative lookups to avoid repeated DB queries for invalid domains)
    if (result) {
      await this.redis.setex(`${CACHE_PREFIX}${normalized}`, CACHE_TTL, JSON.stringify(result));
    } else {
      // M-TP-6: Use empty string as sentinel value for negative cache entries
      // instead of the string 'null' which could be confused with valid JSON.
      await this.redis.setex(`${CACHE_PREFIX}${normalized}`, 60, '');
    }

    return result;
  }

  /**
   * Invalidate cached resolution for a domain.
   * Call this when a tenant's domain or customDomain changes.
   */
  async invalidate(hostname: string): Promise<void> {
    const normalized = hostname.toLowerCase().split(':')[0];
    await this.redis.del(`${CACHE_PREFIX}${normalized}`);
    this.logger.log(`Invalidated domain cache for: ${normalized}`);
  }
}
