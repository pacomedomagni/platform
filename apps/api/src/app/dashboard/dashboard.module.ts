import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
