import { Module, Global } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { DomainResolverService } from './domain-resolver.service';
import { DomainResolverController } from './domain-resolver.controller';

@Global()
@Module({
  imports: [DbModule],
  controllers: [DomainResolverController],
  providers: [DomainResolverService],
  exports: [DomainResolverService],
})
export class DomainResolverModule {}
