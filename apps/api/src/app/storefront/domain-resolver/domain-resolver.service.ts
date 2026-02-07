import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import Redis from 'ioredis';

const CACHE_PREFIX = 'domain:';
const CACHE_TTL = 300; // 5 minutes

export interface ResolvedTenant {
  tenantId: string;
  type: 'subdomain' | 'custom_domain';
}

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);
  private readonly redis: Redis;
  private readonly platformDomain: string;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      password: process.env['REDIS_PASSWORD'],
    });
    this.platformDomain = process.env['DOMAIN'] || 'noslag.com';
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
    if (cached) {
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

    // Cache the result (even null to avoid repeated DB lookups for invalid domains)
    if (result) {
      await this.redis.setex(`${CACHE_PREFIX}${normalized}`, CACHE_TTL, JSON.stringify(result));
    } else {
      // Cache negative lookups for a shorter time (60s)
      await this.redis.setex(`${CACHE_PREFIX}${normalized}`, 60, 'null');
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
