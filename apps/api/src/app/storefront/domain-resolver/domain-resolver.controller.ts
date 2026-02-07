import { Controller, Get, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { DomainResolverService } from './domain-resolver.service';

@Controller('store/resolve')
export class DomainResolverController {
  constructor(private readonly domainResolver: DomainResolverService) {}

  /**
   * GET /api/v1/store/resolve?domain=store1.noslag.com
   * Public endpoint — resolves a hostname to a tenant UUID.
   * Used by the storefront frontend to determine which tenant to load.
   */
  @Get()
  async resolve(@Query('domain') domain: string) {
    if (!domain) {
      throw new BadRequestException('domain query parameter is required');
    }

    const result = await this.domainResolver.resolve(domain);

    if (!result) {
      throw new NotFoundException(`No store found for domain: ${domain}`);
    }

    return result;
  }
}
