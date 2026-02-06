import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  imports: [DbModule],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, JwtAuthGuard, CustomerAuthGuard],
  exports: [CustomerAuthService, JwtAuthGuard, CustomerAuthGuard],
})
export class CustomerAuthModule {}
