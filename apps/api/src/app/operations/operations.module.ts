import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { InventoryManagementModule } from '../inventory-management/inventory-management.module';
import { AuditLogService } from './audit-log.service';
import { WebhookService } from './webhook.service';
import { BackgroundJobService } from './background-job.service';
import { ImportExportService } from './import-export.service';
import { NotificationService } from './notification.service';
import { OperationsController } from './operations.controller';

@Module({
  imports: [DbModule, AuthModule, InventoryManagementModule],
  controllers: [OperationsController],
  providers: [
    AuditLogService,
    WebhookService,
    BackgroundJobService,
    ImportExportService,
    NotificationService,
  ],
  exports: [
    AuditLogService,
    WebhookService,
    BackgroundJobService,
    ImportExportService,
    NotificationService,
  ],
})
export class OperationsModule {}
