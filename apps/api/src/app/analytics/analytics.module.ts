import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AnalyticsController } from './analytics.controller';
import { SalesAnalyticsService } from './sales-analytics.service';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { ReportExportService } from './report-export.service';

@Module({
  imports: [DbModule],
  controllers: [AnalyticsController],
  providers: [
    SalesAnalyticsService,
    InventoryAnalyticsService,
    ReportExportService,
  ],
  exports: [
    SalesAnalyticsService,
    InventoryAnalyticsService,
    ReportExportService,
  ],
})
export class AnalyticsModule {}
