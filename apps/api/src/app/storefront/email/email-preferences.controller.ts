import { Controller, Get, Put, Post, Query, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { EmailPreferencesService, UpdatePreferencesDto } from './email-preferences.service';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { CurrentCustomer } from '../auth/current-customer.decorator';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { Tenant } from '../../tenant.middleware';

const VALID_UNSUBSCRIBE_TYPES = ['marketing', 'orderUpdates', 'promotions', 'newsletter', 'all'] as const;
type UnsubscribeType = typeof VALID_UNSUBSCRIBE_TYPES[number];

class NewsletterSubscribeDto {
  @IsEmail()
  email: string;
}

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
    @Param('type') type: string,
  ) {
    if (!VALID_UNSUBSCRIBE_TYPES.includes(type as UnsubscribeType)) {
      throw new BadRequestException(
        `Invalid unsubscribe type "${type}". Must be one of: ${VALID_UNSUBSCRIBE_TYPES.join(', ')}`
      );
    }
    return this.preferencesService.unsubscribe(tenantId, customerId, type as UnsubscribeType);
  }

  /**
   * One-click unsubscribe via token (no auth required - for email links)
   */
  @Get('unsubscribe')
  async unsubscribeByToken(
    @Query('token') token: string,
    @Query('type') type?: 'marketing' | 'all',
  ) {
    // H4: Validate token is present before calling service
    if (!token) {
      throw new BadRequestException('Unsubscribe token is required');
    }
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
    // H4: Validate token is present before calling service
    if (!token) {
      throw new BadRequestException('Unsubscribe token is required');
    }
    return this.preferencesService.unsubscribeByToken(token, type || 'all');
  }

  /**
   * Subscribe to newsletter (public, no auth required)
   */
  @Post('newsletter/subscribe')
  async subscribeToNewsletter(
    @Tenant() tenantId: string,
    @Body() dto: NewsletterSubscribeDto,
  ) {
    return this.preferencesService.subscribeToNewsletter(tenantId, dto.email);
  }
}
