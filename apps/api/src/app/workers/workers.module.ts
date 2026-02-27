import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '@platform/db';
import { OperationsModule } from '../operations/operations.module';
import { InventoryManagementModule } from '../inventory-management/inventory-management.module';
import { CleanupService } from './cleanup.service';
import { FailedOperationsService } from './failed-operations.service';
import { ProductImportWorker } from './product-import.worker';
import { ProductImportService } from '../storefront/products/product-import.service';
import { ProductsService } from '../storefront/products/products.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
    DbModule,
    OperationsModule, // Provides WebhookService needed by ProductsService and FailedOperationsService
    InventoryManagementModule, // Provides StockMovementService needed by FailedOperationsService
  ],
  providers: [
    CleanupService,
    FailedOperationsService,
    ProductImportWorker,
    ProductImportService,
    ProductsService,
  ],
  exports: [CleanupService, FailedOperationsService],
})
export class WorkersModule {}
