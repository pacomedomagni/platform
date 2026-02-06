import { Controller, Get, Put, Post, Query, Body, Param, UseGuards } from '@nestjs/common';
import { EmailPreferencesService, UpdatePreferencesDto } from './email-preferences.service';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { CurrentCustomer } from '../auth/current-customer.decorator';
import { CurrentTenant } from '../auth/current-tenant.decorator';

@Controller('storefront/email-preferences')
export class EmailPreferencesController {
  constructor(private readonly preferencesService: EmailPreferencesService) {}

  /**
   * Get customer email preferences (requires auth)
   */
  @Get()
  @UseGuards(CustomerAuthGuard)
  async getPreferences(
    @CurrentTenant() tenantId: string,
    @CurrentCustomer() customerId: string,
  ) {
    return this.preferencesService.getPreferences(tenantId, customerId);
  }

  /**
   * Update customer email preferences (requires auth)
   */
  @Put()
  @UseGuards(CustomerAuthGuard)
  async updatePreferences(
    @CurrentTenant() tenantId: string,
    @CurrentCustomer() customerId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(tenantId, customerId, dto);
  }

  /**
   * Unsubscribe from specific email type (requires auth)
   */
  @Post('unsubscribe/:type')
  @UseGuards(CustomerAuthGuard)
  async unsubscribe(
    @CurrentTenant() tenantId: string,
    @CurrentCustomer() customerId: string,
    @Param('type') type: 'marketing' | 'orderUpdates' | 'promotions' | 'newsletter' | 'all',
  ) {
    return this.preferencesService.unsubscribe(tenantId, customerId, type);
  }

  /**
   * One-click unsubscribe via token (no auth required - for email links)
   */
  @Get('unsubscribe')
  async unsubscribeByToken(
    @Query('token') token: string,
    @Query('type') type?: 'marketing' | 'all',
  ) {
    return this.preferencesService.unsubscribeByToken(token, type || 'all');
  }

  /**
   * One-click unsubscribe POST endpoint (RFC 8058 List-Unsubscribe-Post)
   */
  @Post('unsubscribe')
  async unsubscribeByTokenPost(
    @Body('token') token: string,
    @Body('type') type?: 'marketing' | 'all',
  ) {
    return this.preferencesService.unsubscribeByToken(token, type || 'all');
  }
}
