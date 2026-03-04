import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { DbModule } from '@platform/db';
import { AuthModule } from '@platform/auth';
import { MetaModule } from '@platform/meta';
import { BusinessLogicModule } from '@platform/business-logic';
import { QueueModule } from '@platform/queue';
import { StorageModule } from '@platform/storage';
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
import { LoggerModule } from './common/logger';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { AllExceptionsFilter } from './common/filters';
import { EmailWorker } from './workers/email.worker';
import { WorkersModule } from './workers/workers.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { DomainResolverModule } from './storefront/domain-resolver/domain-resolver.module';

@Module({
  imports: [
    // Structured logging with Pino (must be first for early logging)
    LoggerModule,
    // Domain resolver — must load before StorefrontModule (used by TenantMiddleware)
    DomainResolverModule,
    // Rate limiting - relaxed in test/development for E2E, strict in production
    ThrottlerModule.forRoot(
      process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
        ? [{ name: 'short', ttl: 1000, limit: 1000 }, { name: 'medium', ttl: 60000, limit: 10000 }, { name: 'long', ttl: 3600000, limit: 100000 }]
        : [
            { name: 'short', ttl: 1000, limit: 10 },
            { name: 'medium', ttl: 60000, limit: 100 },
            { name: 'long', ttl: 3600000, limit: 1000 },
          ],
    ),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    DbModule,
    AuthModule,
    BusinessLogicModule,
    QueueModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    StorageModule.forRoot({
      provider: {
        type: 's3' as const,
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || 'noslag-uploads',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
        forcePathStyle: true,
      },
    }),
    HealthModule,
    ProvisioningModule,
    StorefrontModule,
    DashboardModule,
    AnalyticsModule,
    OperationsModule,
    InventoryManagementModule,
    CurrencyModule,
    MarketplaceIntegrationsModule,
    WorkersModule,
    MonitoringModule,
    OnboardingModule,
    // MetaModule MUST be last — its UniversalController has catch-all routes
    // (@Get(':doctype')) that would shadow all other routes if registered first
    MetaModule,
  ],
  controllers: [AppController, InventoryController, ReportsController],
  providers: [
    AppService,
    EmailWorker,
    // Global exception filter — logs all unhandled errors via Pino → Loki
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global rate limiting guard (disabled in development/test to avoid per-endpoint @Throttle overrides)
    ...(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? []
      : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
    // Tenant context propagation
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    // Standardize all API responses into { data, meta } envelope
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
