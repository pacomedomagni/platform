import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { MetaModule } from '@platform/meta';
import { AppController } from './app.controller';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
