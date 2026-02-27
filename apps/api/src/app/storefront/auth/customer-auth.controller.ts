import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { CurrentCustomer } from './current-customer.decorator';
import {
  RegisterCustomerDto,
  LoginCustomerDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
  VerifyEmailDto,
  AddAddressDto,
} from './dto';

@Controller('store/auth')
export class CustomerAuthController {
  constructor(private readonly authService: CustomerAuthService) {}

  /**
   * Register new customer
   * POST /api/v1/store/auth/register
   */
  @Post('register')
  @Throttle({ medium: { limit: 5, ttl: 60000 } }) // 5 registrations per minute
  async register(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: RegisterCustomerDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.authService.register(tenantId, dto);
  }

  /**
   * Login customer
   * POST /api/v1/store/auth/login
   */
  @Post('login')
  @Throttle({ medium: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  async login(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: LoginCustomerDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.authService.login(tenantId, dto);
  }

  /**
   * Get current customer profile
   * GET /api/v1/store/auth/me
   */
  @Get('me')
  @UseGuards(CustomerAuthGuard)
  async getProfile(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.getProfile(tenantId, customerId);
  }

  /**
   * Update customer profile
   * PUT /api/v1/store/auth/me
   */
  @Put('me')
  @UseGuards(CustomerAuthGuard)
  async updateProfile(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string,
    @Body() dto: UpdateProfileDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.updateProfile(tenantId, customerId, dto);
  }

  /**
   * Change password
   * POST /api/v1/store/auth/change-password
   */
  @Post('change-password')
  @UseGuards(CustomerAuthGuard)
  async changePassword(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string,
    @Body() dto: ChangePasswordDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.changePassword(tenantId, customerId, dto);
  }

  /**
   * Request password reset
   * POST /api/v1/store/auth/forgot-password
   */
  @Post('forgot-password')
  @Throttle({ medium: { limit: 3, ttl: 60000 } }) // 3 requests per minute to prevent email spam
  async forgotPassword(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: ForgotPasswordDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.authService.forgotPassword(tenantId, dto.email);
  }

  /**
   * Reset password with token
   * POST /api/v1/store/auth/reset-password
   */
  @Post('reset-password')
  @Throttle({ strict: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  async resetPassword(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: ResetPasswordDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.authService.resetPassword(tenantId, dto.token, dto.password);
  }

  /**
   * Verify email with token
   * POST /api/v1/store/auth/verify-email
   */
  @Post('verify-email')
  async verifyEmail(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: VerifyEmailDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.authService.verifyEmail(tenantId, dto.token);
  }

  /**
   * Resend verification email
   * POST /api/v1/store/auth/resend-verification
   */
  @Post('resend-verification')
  @UseGuards(CustomerAuthGuard)
  async resendVerification(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.resendVerificationEmail(tenantId, customerId);
  }

  // ============ ADDRESS MANAGEMENT ============

  /**
   * Get customer addresses
   * GET /api/v1/store/auth/addresses
   */
  @Get('addresses')
  @UseGuards(CustomerAuthGuard)
  async getAddresses(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.getAddresses(tenantId, customerId);
  }

  /**
   * Add address
   * POST /api/v1/store/auth/addresses
   */
  @Post('addresses')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async addAddress(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string,
    @Body() dto: AddAddressDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.addAddress(tenantId, customerId, dto);
  }

  /**
   * Update address
   * PUT /api/v1/store/auth/addresses/:id
   */
  @Put('addresses/:id')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async updateAddress(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string,
    @Param('id') addressId: string,
    @Body() dto: Partial<AddAddressDto>
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.updateAddress(
      tenantId,
      customerId,
      addressId,
      dto
    );
  }

  /**
   * Delete address
   * DELETE /api/v1/store/auth/addresses/:id
   */
  @Delete('addresses/:id')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async deleteAddress(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentCustomer() customerId: string,
    @Param('id') addressId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.authService.deleteAddress(tenantId, customerId, addressId);
  }
}
