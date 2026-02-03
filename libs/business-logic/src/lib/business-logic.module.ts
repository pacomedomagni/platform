import { Module, OnModuleInit } from '@nestjs/common';
import { MetaModule } from '@platform/meta';
import { BusinessLogicService } from './hooks';
import { SeederService } from './seeder.service';
import { ReportsService } from './reports';
import { StockService } from './inventory/stock.service';

@Module({
  imports: [MetaModule],
  providers: [BusinessLogicService, SeederService, ReportsService, StockService],
  exports: [BusinessLogicService, ReportsService, StockService],
})
export class BusinessLogicModule implements OnModuleInit {
    constructor(private readonly service: BusinessLogicService) {}

    onModuleInit() {
        // Just ensuring it's instantiated
    }
}
