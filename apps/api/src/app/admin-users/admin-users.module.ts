import { Module } from '@nestjs/common';
import { DbModule, DbService } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { EmailModule } from '@platform/email';
import { AdminUsersController } from './admin-users.controller';
import { InvitesPublicController } from './invites-public.controller';
import { AdminUsersService } from './admin-users.service';
import { InviteEmailSenderImpl } from './invite-email.sender';

@Module({
  imports: [DbModule, AuthModule, EmailModule],
  controllers: [AdminUsersController, InvitesPublicController],
  providers: [
    InviteEmailSenderImpl,
    {
      provide: AdminUsersService,
      useFactory: (db: DbService, sender: InviteEmailSenderImpl) => new AdminUsersService(db, sender),
      inject: [DbService, InviteEmailSenderImpl],
    },
  ],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
