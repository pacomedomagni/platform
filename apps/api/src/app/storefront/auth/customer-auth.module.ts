import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { OperationsModule } from '../../operations/operations.module';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  imports: [DbModule, OperationsModule],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, JwtAuthGuard, CustomerAuthGuard],
  exports: [CustomerAuthService, JwtAuthGuard, CustomerAuthGuard],
})
export class CustomerAuthModule {}
