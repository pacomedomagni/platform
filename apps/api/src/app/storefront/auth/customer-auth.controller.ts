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
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerAuthService } from './customer-auth.service';
import {
  RegisterCustomerDto,
  LoginCustomerDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
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
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 login attempts per minute
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
  async getProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.getProfile(tenantId, payload.customerId);
  }

  /**
   * Update customer profile
   * PUT /api/v1/store/auth/me
   */
  @Put('me')
  async updateProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateProfileDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.updateProfile(tenantId, payload.customerId, dto);
  }

  /**
   * Change password
   * POST /api/v1/store/auth/change-password
   */
  @Post('change-password')
  async changePassword(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: ChangePasswordDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.changePassword(tenantId, payload.customerId, dto);
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
  @Throttle({ medium: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
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
    @Body() dto: { token: string }
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!dto.token) {
      throw new BadRequestException('Verification token required');
    }
    return this.authService.verifyEmail(tenantId, dto.token);
  }

  /**
   * Resend verification email
   * POST /api/v1/store/auth/resend-verification
   */
  @Post('resend-verification')
  async resendVerification(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.resendVerificationEmail(tenantId, payload.customerId);
  }

  // ============ ADDRESS MANAGEMENT ============

  /**
   * Get customer addresses
   * GET /api/v1/store/auth/addresses
   */
  @Get('addresses')
  async getAddresses(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.getAddresses(tenantId, payload.customerId);
  }

  /**
   * Add address
   * POST /api/v1/store/auth/addresses
   */
  @Post('addresses')
  async addAddress(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: AddAddressDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.addAddress(tenantId, payload.customerId, dto);
  }

  /**
   * Update address
   * PUT /api/v1/store/auth/addresses/:id
   */
  @Put('addresses/:id')
  async updateAddress(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('id') addressId: string,
    @Body() dto: Partial<AddAddressDto>
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.updateAddress(
      tenantId,
      payload.customerId,
      addressId,
      dto
    );
  }

  /**
   * Delete address
   * DELETE /api/v1/store/auth/addresses/:id
   */
  @Delete('addresses/:id')
  async deleteAddress(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('id') addressId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const token = this.extractToken(authHeader);
    const payload = await this.authService.verifyToken(token);

    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.deleteAddress(tenantId, payload.customerId, addressId);
  }

  // ============ HELPERS ============

  private extractToken(authHeader: string): string {
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    return token;
  }
}
