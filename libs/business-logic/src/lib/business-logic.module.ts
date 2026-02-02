import { Module, OnModuleInit } from '@nestjs/common';
import { MetaModule } from '@platform/meta';
import { BusinessLogicService } from './hooks';
import { SeederService } from './seeder.service';

@Module({
  imports: [MetaModule],
  providers: [BusinessLogicService, SeederService],
  exports: [BusinessLogicService],
})
export class BusinessLogicModule implements OnModuleInit {
    constructor(private readonly service: BusinessLogicService) {}

    onModuleInit() {
        // Just ensuring it's instantiated
    }
}
