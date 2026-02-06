import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { I18nService } from './i18n.service';
import { I18nAdminController, I18nPublicController } from './i18n.controller';
import { CustomerAuthModule } from '../auth/customer-auth.module';

@Module({
  imports: [DbModule, CustomerAuthModule],
  controllers: [I18nAdminController, I18nPublicController],
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
