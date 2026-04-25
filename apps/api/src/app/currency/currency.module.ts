import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { OperationsModule } from '../operations/operations.module';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';

@Module({
  imports: [DbModule, OperationsModule],
  controllers: [CurrencyController],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
