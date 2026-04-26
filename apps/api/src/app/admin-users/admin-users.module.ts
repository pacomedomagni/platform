import { Module } from '@nestjs/common';
import { DbModule, DbService } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { EmailModule } from '@platform/email';
import { AdminUsersController } from './admin-users.controller';
import { InvitesPublicController } from './invites-public.controller';
import { AdminUsersService } from './admin-users.service';
import { InviteEmailSenderImpl } from './invite-email.sender';
import { OperationsModule } from '../operations/operations.module';
import { AuditLogService } from '../operations/audit-log.service';

@Module({
  imports: [DbModule, AuthModule, EmailModule, OperationsModule],
  controllers: [AdminUsersController, InvitesPublicController],
  providers: [
    InviteEmailSenderImpl,
    {
      provide: AdminUsersService,
      useFactory: (db: DbService, sender: InviteEmailSenderImpl, audit: AuditLogService) =>
        new AdminUsersService(db, sender, audit),
      inject: [DbService, InviteEmailSenderImpl, AuditLogService],
    },
  ],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
