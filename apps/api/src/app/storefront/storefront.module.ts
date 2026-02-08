import { Module } from '@nestjs/common';
import { DbModule } from '@platform/db';
import { EmailModule } from '@platform/email';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { CartController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutService } from './checkout/checkout.service';
import { CustomerAuthModule } from './auth/customer-auth.module';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { StripeService } from './payments/stripe.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { EcommerceModule } from './ecommerce/ecommerce.module';
import { I18nModule } from './i18n/i18n.module';
import { EmailPreferencesController } from './email/email-preferences.controller';
import { EmailPreferencesService } from './email/email-preferences.service';
import { SendGridWebhookController } from './email/sendgrid-webhook.controller';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { ThemesModule } from './themes/themes.module';
import { InventoryManagementModule } from '../inventory-management/inventory-management.module';
import { WorkersModule } from '../workers/workers.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UploadController } from './uploads/upload.controller';
import { StoreSettingsController } from './settings/store-settings.controller';
import { StoreSettingsService } from './settings/store-settings.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { StorePagesController } from './pages/store-pages.controller';
import { StorePagesService } from './pages/store-pages.service';
import { ProductImportController } from './products/product-import.controller';
import { ProductImportService } from './products/product-import.service';
import { ShippingAdminController, ShippingPublicController } from './shipping/shipping.controller';
import { ShippingService } from './shipping/shipping.service';
import { PageSectionsController } from './pages/sections.controller';
import { PageSectionsService } from './pages/sections.service';
import { DigitalDownloadController } from './digital/digital-download.controller';
import { DigitalFulfillmentService } from './digital/digital-fulfillment.service';
import { ScheduledReportsController } from '../operations/scheduled-reports.controller';
import { ScheduledReportsService } from '../operations/scheduled-reports.service';
import { InvoicingController } from './invoicing/invoicing.controller';
import { InvoicingService } from './invoicing/invoicing.service';
import { PurchaseOrdersController } from './purchase-orders/purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders/purchase-orders.service';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { TaxRulesController } from './tax-rules/tax-rules.controller';
import { TaxRulesService } from './tax-rules/tax-rules.service';
import { BusinessHealthController } from './business-health/business-health.controller';
import { BusinessHealthService } from './business-health/business-health.service';
import { ReorderAlertsController } from './reorder-alerts/reorder-alerts.controller';
import { ReorderAlertsService } from './reorder-alerts/reorder-alerts.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { SeoController } from './seo/seo.controller';
import { SeoService } from './seo/seo.service';
import { AbandonedCartController } from './abandoned-cart/abandoned-cart.controller';
import { AbandonedCartService } from './abandoned-cart/abandoned-cart.service';
import { DiscountRulesController } from './discount-rules/discount-rules.controller';
import { DiscountRulesService } from './discount-rules/discount-rules.service';
import { ReturnsController } from './returns/returns.controller';
import { ReturnsService } from './returns/returns.service';
import { CrmController } from './crm/crm.controller';
import { CrmService } from './crm/crm.service';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';

@Module({
  imports: [
    DbModule,
    CustomerAuthModule,
    EcommerceModule,
    I18nModule,
    ThemesModule,
    InventoryManagementModule,
    WorkersModule,
    OnboardingModule,
    EmailModule.forRoot({
      smtp: {
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: process.env['SMTP_USER'] ? {
          user: process.env['SMTP_USER'],
          pass: process.env['SMTP_PASS'] || '',
        } : undefined,
      },
      defaults: {
        from: process.env['SMTP_FROM'] || 'noreply@example.com',
      },
      previewMode: process.env['NODE_ENV'] !== 'production',
    }),
  ],
  controllers: [
    ProductsController,
    CartController,
    CheckoutController,
    PaymentsController,
    OrdersController,
    EmailPreferencesController,
    SendGridWebhookController,
    OnboardingController,
    UploadController,
    StoreSettingsController,
    DashboardController,
    StorePagesController,
    ProductImportController,
    ShippingAdminController,
    ShippingPublicController,
    PageSectionsController,
    DigitalDownloadController,
    ScheduledReportsController,
    InvoicingController,
    PurchaseOrdersController,
    ExpensesController,
    TaxRulesController,
    BusinessHealthController,
    ReorderAlertsController,
    NotificationsController,
    SeoController,
    AbandonedCartController,
    DiscountRulesController,
    ReturnsController,
    CrmController,
    ActivityController,
  ],
  providers: [
    ProductsService,
    CartService,
    CheckoutService,
    PaymentsService,
    StripeService,
    OrdersService,
    EmailPreferencesService,
    OnboardingService,
    StoreSettingsService,
    DashboardService,
    StorePagesService,
    ProductImportService,
    ShippingService,
    PageSectionsService,
    DigitalFulfillmentService,
    ScheduledReportsService,
    InvoicingService,
    PurchaseOrdersService,
    ExpensesService,
    TaxRulesService,
    BusinessHealthService,
    ReorderAlertsService,
    NotificationsService,
    SeoService,
    AbandonedCartService,
    DiscountRulesService,
    ReturnsService,
    CrmService,
    ActivityService,
  ],
  exports: [
    CustomerAuthModule,
    ProductsService,
    CartService,
    CheckoutService,
    PaymentsService,
    StripeService,
    OrdersService,
  ],
})
export class StorefrontModule {}
