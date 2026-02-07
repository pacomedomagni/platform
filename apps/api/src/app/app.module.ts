import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { HealthModule } from './health/health.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { StorefrontModule } from './storefront/storefront.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OperationsModule } from './operations/operations.module';
import { InventoryManagementModule } from './inventory-management/inventory-management.module';
import { CurrencyModule } from './currency/currency.module';
import { MarketplaceIntegrationsModule } from './marketplace-integrations/marketplace-integrations.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { SentryInterceptor } from './sentry/sentry.interceptor';
import { EmailWorker } from './workers/email.worker';

@Module({
  imports: [
    // Rate limiting - 100 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    DbModule,
    AuthModule,
    MetaModule,
    BusinessLogicModule,
    HealthModule,
    ProvisioningModule,
    StorefrontModule,
    DashboardModule,
    AnalyticsModule,
    OperationsModule,
    InventoryManagementModule,
    CurrencyModule,
    MarketplaceIntegrationsModule,
  ],
  controllers: [AppController, InventoryController, ReportsController],
  providers: [
    AppService,
    EmailWorker,
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global request logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Tenant context propagation
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    // Sentry context interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
