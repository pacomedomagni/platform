import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
