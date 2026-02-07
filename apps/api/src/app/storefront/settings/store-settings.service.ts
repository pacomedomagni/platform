import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { UpdateStoreSettingsDto } from './store-settings.dto';

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

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        id: true,
        name: true,
        domain: true,
        defaultTaxRate: true,
        defaultShippingRate: true,
        freeShippingThreshold: true,
      },
    });

    return {
      businessName: updated.name,
      storeUrl: `${updated.domain}.noslag.com`,
      defaultTaxRate: Number(updated.defaultTaxRate),
      defaultShippingRate: Number(updated.defaultShippingRate),
      freeShippingThreshold: Number(updated.freeShippingThreshold),
    };
  }
}
