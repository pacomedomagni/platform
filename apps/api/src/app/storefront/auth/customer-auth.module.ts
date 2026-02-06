import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';

@Module({
  imports: [DbModule],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
