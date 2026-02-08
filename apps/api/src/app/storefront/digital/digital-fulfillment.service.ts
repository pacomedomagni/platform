import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';

@Injectable()
export class DigitalFulfillmentService {
  private readonly logger = new Logger(DigitalFulfillmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDownloadEntries(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const digitalItems = order.items.filter((item) => item.product?.isDigital);
    if (digitalItems.length === 0) return [];

    const downloads = await Promise.all(
      digitalItems.map((item) =>
        this.prisma.digitalDownload.create({
          data: {
            tenantId,
            orderId,
            productId: item.productId!,
            maxDownloads: item.product?.downloadLimit ?? null,
            expiresAt: item.product?.downloadExpiry
              ? new Date(Date.now() + item.product.downloadExpiry * 24 * 60 * 60 * 1000)
              : null,
          },
        })
      )
    );

    return downloads;
  }

  async getDownloads(tenantId: string, orderId: string) {
    return this.prisma.digitalDownload.findMany({
      where: { tenantId, orderId },
      include: {
        product: { select: { displayName: true, digitalFileKey: true, images: true } },
      },
    });
  }

  async trackDownload(tenantId: string, downloadId: string) {
    const download = await this.prisma.digitalDownload.findFirst({
      where: { id: downloadId, tenantId },
      include: { product: true },
    });
    if (!download) throw new NotFoundException('Download not found');

    if (download.expiresAt && download.expiresAt < new Date()) {
      throw new BadRequestException('Download link has expired');
    }

    if (download.maxDownloads && download.downloadCount >= download.maxDownloads) {
      throw new BadRequestException('Download limit reached');
    }

    await this.prisma.digitalDownload.update({
      where: { id: downloadId },
      data: { downloadCount: { increment: 1 } },
    });

    // Return the file key for the caller to generate a presigned URL
    return {
      fileKey: download.product.digitalFileKey,
      productName: download.product.displayName,
      remainingDownloads: download.maxDownloads
        ? download.maxDownloads - download.downloadCount - 1
        : null,
    };
  }

  async listCustomerDownloads(tenantId: string, customerId: string) {
    return this.prisma.digitalDownload.findMany({
      where: {
        tenantId,
        order: { customerId },
      },
      include: {
        product: { select: { displayName: true, images: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
