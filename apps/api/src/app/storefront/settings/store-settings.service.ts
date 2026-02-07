import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { UpdateStoreSettingsDto } from './store-settings.dto';
import { promises as dns } from 'dns';

const normalizeDomain = (domain: string) => domain.trim().toLowerCase().replace(/\.$/, '');

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        domain: true,
        customDomain: true,
        customDomainStatus: true,
        customDomainVerifiedAt: true,
        defaultTaxRate: true,
        defaultShippingRate: true,
        freeShippingThreshold: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      businessName: tenant.name,
      storeUrl: `${tenant.domain}.noslag.com`,
      customDomain: tenant.customDomain,
      customDomainStatus: tenant.customDomainStatus,
      customDomainVerifiedAt: tenant.customDomainVerifiedAt,
      defaultTaxRate: Number(tenant.defaultTaxRate),
      defaultShippingRate: Number(tenant.defaultShippingRate),
      freeShippingThreshold: Number(tenant.freeShippingThreshold),
    };
  }

  async updateSettings(tenantId: string, dto: UpdateStoreSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.businessName !== undefined) updateData.name = dto.businessName;
    if (dto.defaultTaxRate !== undefined) updateData.defaultTaxRate = dto.defaultTaxRate;
    if (dto.defaultShippingRate !== undefined) updateData.defaultShippingRate = dto.defaultShippingRate;
    if (dto.freeShippingThreshold !== undefined) updateData.freeShippingThreshold = dto.freeShippingThreshold;
    if (dto.customDomain !== undefined) {
      const normalized = normalizeDomain(dto.customDomain);
      if (normalized.length === 0) {
        updateData.customDomain = null;
        updateData.customDomainStatus = 'not_set';
        updateData.customDomainVerifiedAt = null;
      } else {
        updateData.customDomain = normalized;
        updateData.customDomainStatus = 'pending';
        updateData.customDomainVerifiedAt = null;
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        id: true,
        name: true,
        domain: true,
        customDomain: true,
        customDomainStatus: true,
        customDomainVerifiedAt: true,
        defaultTaxRate: true,
        defaultShippingRate: true,
        freeShippingThreshold: true,
      },
    });

    return {
      businessName: updated.name,
      storeUrl: `${updated.domain}.noslag.com`,
      customDomain: updated.customDomain,
      customDomainStatus: updated.customDomainStatus,
      customDomainVerifiedAt: updated.customDomainVerifiedAt,
      defaultTaxRate: Number(updated.defaultTaxRate),
      defaultShippingRate: Number(updated.defaultShippingRate),
      freeShippingThreshold: Number(updated.freeShippingThreshold),
    };
  }

  async verifyCustomDomain(tenantId: string, customDomain: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        customDomain: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const normalized = normalizeDomain(customDomain);
    const targetCname = normalizeDomain(process.env['CUSTOM_DOMAIN_CNAME_TARGET'] || 'noslag.com');
    const expectedARecords = (process.env['CUSTOM_DOMAIN_A_RECORDS'] || '')
      .split(',')
      .map((record) => record.trim())
      .filter(Boolean);

    let isVerified = false;
    let checked = false;
    let cnameRecords: string[] = [];
    let aRecords: string[] = [];

    try {
      cnameRecords = (await dns.resolveCname(normalized)).map((record) => normalizeDomain(record));
      checked = true;
      if (cnameRecords.includes(targetCname)) {
        isVerified = true;
      }
    } catch {
      // Ignore; some domains use A/AAAA records instead of CNAME.
    }

    if (!isVerified) {
      try {
        aRecords = await dns.resolve4(normalized);
        checked = true;
        if (expectedARecords.length > 0) {
          isVerified = aRecords.some((record) => expectedARecords.includes(record));
        }
      } catch {
        // DNS check failed.
      }
    }

    const status = isVerified ? 'verified' : checked ? 'pending' : 'failed';

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        customDomain: normalized,
        customDomainStatus: status,
        customDomainVerifiedAt: isVerified ? new Date() : null,
      },
    });

    return {
      customDomain: normalized,
      status,
      cnameRecords,
      aRecords,
      targetCname,
      verifiedAt: isVerified ? new Date().toISOString() : null,
    };
  }
}
