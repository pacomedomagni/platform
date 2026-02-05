import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import {
  CreateTenantDto,
  ProvisioningStatus,
  ProvisioningStatusDto,
} from './dto/create-tenant.dto';
import { SeedDataService } from './seed-data.service';

const PROVISIONING_KEY_PREFIX = 'provisioning:';
const PROVISIONING_TTL = 3600; // 1 hour

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seedData: SeedDataService,
  ) {
    const redisHost = process.env['REDIS_HOST'] || 'localhost';
    const redisPort = parseInt(process.env['REDIS_PORT'] || '6379', 10);
    const redisPassword = process.env['REDIS_PASSWORD'];

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    });
  }

  /**
   * Initiate tenant provisioning
   * Returns immediately with tenantId, actual provisioning happens async
   */
  async createTenant(dto: CreateTenantDto): Promise<{ tenantId: string; status: ProvisioningStatus }> {
    // Check if domain is already taken
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { domain: dto.domain },
    });

    if (existingTenant) {
      throw new ConflictException(`Domain "${dto.domain}" is already taken`);
    }

    // Check if email is already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail },
    });

    if (existingUser) {
      throw new ConflictException(`Email "${dto.ownerEmail}" is already registered`);
    }

    // Create tenant with PENDING status
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.businessName,
        domain: dto.domain,
        baseCurrency: dto.baseCurrency || 'USD',
        isActive: false, // Will be activated after provisioning completes
      },
    });

    // Store provisioning state in Redis
    await this.updateProvisioningStatus(tenant.id, {
      tenantId: tenant.id,
      status: ProvisioningStatus.PENDING,
      progress: 0,
      currentStep: 'Queued for provisioning...',
    });

    // Start async provisioning
    // In production, this would be a queue job. For now, we run it in background.
    this.provisionTenantAsync(tenant.id, dto).catch((err) => {
      this.logger.error(`Provisioning failed for tenant ${tenant.id}: ${err.message}`);
    });

    return {
      tenantId: tenant.id,
      status: ProvisioningStatus.PENDING,
    };
  }

  /**
   * Get provisioning status
   */
  async getProvisioningStatus(tenantId: string): Promise<ProvisioningStatusDto> {
    const statusJson = await this.redis.get(`${PROVISIONING_KEY_PREFIX}${tenantId}`);

    if (!statusJson) {
      // Check if tenant exists and is active (already provisioned)
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      if (tenant.isActive) {
        return {
          tenantId,
          status: ProvisioningStatus.READY,
          progress: 100,
          currentStep: 'Ready!',
        };
      }

      // Tenant exists but no status - might be in limbo
      return {
        tenantId,
        status: ProvisioningStatus.PENDING,
        progress: 0,
        currentStep: 'Waiting...',
      };
    }

    return JSON.parse(statusJson);
  }

  /**
   * Async provisioning - runs all seeding steps
   */
  private async provisionTenantAsync(tenantId: string, dto: CreateTenantDto): Promise<void> {
    const startTime = Date.now();

    try {
      // Step 1: Creating tenant (already done, just update status)
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.CREATING_TENANT,
        progress: 10,
        currentStep: 'Creating tenant...',
        estimatedSecondsRemaining: 30,
      });

      // Step 2: Create admin user
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.CREATING_USER,
        progress: 20,
        currentStep: 'Creating admin user...',
        estimatedSecondsRemaining: 25,
      });

      const hashedPassword = await bcrypt.hash(dto.ownerPassword, 12);
      await this.prisma.user.create({
        data: {
          email: dto.ownerEmail,
          password: hashedPassword,
          tenantId,
          roles: ['admin', 'user'],
        },
      });

      // Step 3: Seed Chart of Accounts
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.SEEDING_ACCOUNTS,
        progress: 40,
        currentStep: 'Setting up chart of accounts...',
        estimatedSecondsRemaining: 20,
      });
      await this.seedData.seedAccounts(tenantId);

      // Step 4: Seed Warehouse & Locations
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.SEEDING_WAREHOUSE,
        progress: 60,
        currentStep: 'Creating default warehouse...',
        estimatedSecondsRemaining: 15,
      });
      await this.seedData.seedWarehouse(tenantId);

      // Step 5: Seed UOMs
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.SEEDING_UOMS,
        progress: 80,
        currentStep: 'Setting up units of measure...',
        estimatedSecondsRemaining: 10,
      });
      await this.seedData.seedUoms();

      // Step 6: Seed Defaults (DocTypes, Perms, etc.)
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.SEEDING_DEFAULTS,
        progress: 90,
        currentStep: 'Configuring defaults...',
        estimatedSecondsRemaining: 5,
      });
      await this.seedData.seedDefaults(tenantId);

      // Activate tenant
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: true },
      });

      // Complete
      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(`Tenant ${tenantId} provisioned successfully in ${duration.toFixed(1)}s`);

      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.READY,
        progress: 100,
        currentStep: 'Ready!',
        estimatedSecondsRemaining: 0,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Provisioning failed for tenant ${tenantId}:`, error);

      // Mark as failed
      await this.updateProvisioningStatus(tenantId, {
        tenantId,
        status: ProvisioningStatus.FAILED,
        progress: 0,
        currentStep: 'Provisioning failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Deactivate tenant
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });

      throw error;
    }
  }

  /**
   * Update provisioning status in Redis
   */
  private async updateProvisioningStatus(
    tenantId: string,
    status: ProvisioningStatusDto,
  ): Promise<void> {
    await this.redis.setex(
      `${PROVISIONING_KEY_PREFIX}${tenantId}`,
      PROVISIONING_TTL,
      JSON.stringify(status),
    );
  }

  /**
   * Retry failed provisioning
   */
  async retryProvisioning(tenantId: string, dto: CreateTenantDto): Promise<{ status: ProvisioningStatus }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    if (tenant.isActive) {
      return { status: ProvisioningStatus.READY };
    }

    // Reset status and retry
    await this.updateProvisioningStatus(tenantId, {
      tenantId,
      status: ProvisioningStatus.PENDING,
      progress: 0,
      currentStep: 'Retrying provisioning...',
    });

    // Restart async provisioning
    this.provisionTenantAsync(tenantId, dto).catch((err) => {
      this.logger.error(`Retry provisioning failed for tenant ${tenantId}: ${err.message}`);
    });

    return { status: ProvisioningStatus.PENDING };
  }
}
