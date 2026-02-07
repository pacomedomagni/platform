import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';

/**
 * Guard that blocks public storefront access when the store is not yet published.
 * Returns 503 "Store is not yet open" for unpublished stores.
 * Should NOT be applied to admin routes.
 */
@Injectable()
export class StorePublishedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId) {
      return true; // Let other guards handle missing tenant
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { storePublished: true },
    });

    if (tenant && !tenant.storePublished) {
      throw new ServiceUnavailableException('Store is not yet open');
    }

    return true;
  }
}
