import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DbModule } from '@platform/db';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './guards/roles.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { StoreAdminGuard } from './guards/store-admin.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    DbModule
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, RolesGuard, ApiKeyGuard, StoreAdminGuard],
  exports: [PassportModule, AuthService, RolesGuard, ApiKeyGuard, StoreAdminGuard],
})
export class AuthModule {}
