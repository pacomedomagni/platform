import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: {
    reportType: string;
    schedule: string;
    recipients: string[];
    format?: string;
  }) {
    return this.prisma.scheduledReport.create({
      data: {
        tenantId,
        reportType: dto.reportType,
        schedule: dto.schedule,
        recipients: dto.recipients,
        format: dto.format || 'csv',
      },
    });
  }

  async update(tenantId: string, id: string, dto: {
    schedule?: string;
    recipients?: string[];
    format?: string;
    isActive?: boolean;
  }) {
    const report = await this.prisma.scheduledReport.findFirst({ where: { id, tenantId } });
    if (!report) throw new NotFoundException('Scheduled report not found');

    return this.prisma.scheduledReport.update({
      where: { id },
      data: {
        ...(dto.schedule && { schedule: dto.schedule }),
        ...(dto.recipients && { recipients: dto.recipients }),
        ...(dto.format && { format: dto.format }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const report = await this.prisma.scheduledReport.findFirst({ where: { id, tenantId } });
    if (!report) throw new NotFoundException('Scheduled report not found');

    await this.prisma.scheduledReport.delete({ where: { id } });
    return { success: true };
  }
}
