import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { FunnelService } from './funnel.service';
import { FunnelController } from './funnel.controller';

@Module({
  imports: [DbModule],
  controllers: [FunnelController],
  providers: [FunnelService],
  exports: [FunnelService],
})
export class AnalyticsFunnelModule {}
