import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  Req,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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
   * Extract tenantId from JWT (request.user) for authenticated endpoints.
   * Falls back to header only if JWT tenantId is not available.
   * Throws if they mismatch.
   */
  private resolveAuthenticatedTenantId(req: Request): string {
    const jwtTenantId = (req as any).user?.tenantId;
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;

    if (jwtTenantId && headerTenantId && jwtTenantId !== headerTenantId) {
      throw new UnauthorizedException('Tenant ID mismatch between token and header');
    }

    const tenantId = jwtTenantId || headerTenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return tenantId;
  }

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
    @Req() req: Request,
    @CurrentCustomer() customerId: string
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
    return this.authService.getProfile(tenantId, customerId);
  }

  /**
   * Update customer profile
   * PUT /api/v1/store/auth/me
   */
  @Put('me')
  @UseGuards(CustomerAuthGuard)
  async updateProfile(
    @Req() req: Request,
    @CurrentCustomer() customerId: string,
    @Body() dto: UpdateProfileDto
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
    return this.authService.updateProfile(tenantId, customerId, dto);
  }

  /**
   * Change password
   * POST /api/v1/store/auth/change-password
   */
  @Post('change-password')
  @UseGuards(CustomerAuthGuard)
  async changePassword(
    @Req() req: Request,
    @CurrentCustomer() customerId: string,
    @Body() dto: ChangePasswordDto
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
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
    @Req() req: Request,
    @CurrentCustomer() customerId: string
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
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
    @Req() req: Request,
    @CurrentCustomer() customerId: string
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
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
    @Req() req: Request,
    @CurrentCustomer() customerId: string,
    @Body() dto: AddAddressDto
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
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
    @Req() req: Request,
    @CurrentCustomer() customerId: string,
    @Param('id') addressId: string,
    @Body() dto: Partial<AddAddressDto>
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
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
    @Req() req: Request,
    @CurrentCustomer() customerId: string,
    @Param('id') addressId: string
  ) {
    const tenantId = this.resolveAuthenticatedTenantId(req);
    return this.authService.deleteAddress(tenantId, customerId, addressId);
  }
}
