import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '@platform/db';
import { CleanupService } from './cleanup.service';
import { FailedOperationsService } from './failed-operations.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
    DbModule,
  ],
  providers: [CleanupService, FailedOperationsService],
  exports: [CleanupService, FailedOperationsService],
})
export class WorkersModule {}
