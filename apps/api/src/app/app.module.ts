import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { MetaModule } from '@platform/meta';
import { BusinessLogicModule } from '@platform/business-logic';
import { AppController } from './app.controller';
import { InventoryController } from './inventory.controller';
import { ReportsController } from './reports.controller';
import { AppService } from './app.service';
import { TenantMiddleware } from './tenant.middleware';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    DbModule,
    AuthModule,
    MetaModule,
    BusinessLogicModule,
  ],
  controllers: [AppController, InventoryController, ReportsController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
