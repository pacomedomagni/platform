import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { AuditLogService } from './audit-log.service';
import { WebhookService } from './webhook.service';
import { BackgroundJobService } from './background-job.service';
import { ImportExportService } from './import-export.service';
import { NotificationService } from './notification.service';
import { OperationsController } from './operations.controller';

@Module({
  imports: [DbModule, AuthModule],
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
