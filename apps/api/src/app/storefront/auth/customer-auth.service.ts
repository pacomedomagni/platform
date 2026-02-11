/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { EmailService } from '@platform/email';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  RegisterCustomerDto,
  LoginCustomerDto,
  UpdateProfileDto,
  ChangePasswordDto,
  AddAddressDto,
} from './dto';

// Fail fast if JWT_SECRET is not set outside dev/test
const JWT_SECRET = process.env['JWT_SECRET'];
const NODE_ENV = process.env['NODE_ENV'];
const ALLOW_FALLBACK_SECRET = NODE_ENV === 'development' || NODE_ENV === 'test';

if (!JWT_SECRET && !ALLOW_FALLBACK_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required in all environments except development and test'
  );
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-change-in-production';

const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY = 1 * 60 * 60 * 1000; // 1 hour
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class CustomerAuthService implements OnModuleInit {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(EmailService) private readonly emailService?: EmailService
  ) {}

  onModuleInit() {
    if (!JWT_SECRET && ALLOW_FALLBACK_SECRET) {
      this.logger.warn('JWT_SECRET not set - using development default. DO NOT USE IN PRODUCTION!');
    }
  }

  /**
   * Register a new customer
   */
  async register(tenantId: string, dto: RegisterCustomerDto) {
    // Check if email already exists
    const existing = await this.prisma.storeCustomer.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });

    if (existing) {
      // Return generic success to prevent email enumeration
      this.logger.warn(`Registration attempt for existing email in tenant ${tenantId}`);
      return {
        message: 'Registration initiated. Please check your email for verification.',
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Create customer
    const customer = await this.prisma.storeCustomer.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        acceptsMarketing: dto.acceptsMarketing ?? false,
        isActive: true,
      },
    });

    // Link any guest orders placed with the same email to this new account
    await this.prisma.order.updateMany({
      where: {
        tenantId,
        email: dto.email.toLowerCase(),
        customerId: null,
      },
      data: { customerId: customer.id },
    });

    // Send verification email (synchronous - critical)
    await this.sendVerificationEmail(customer.id, tenantId);

    // Send welcome email (async - non-critical)
    this.sendWelcomeEmailAsync(customer.id, tenantId);

    // Generate token
    const token = this.generateToken(customer.id, tenantId);

    return {
      customer: this.mapCustomerToResponse(customer),
      token,
    };
  }

  /**
   * Login customer
   */
  async login(tenantId: string, dto: LoginCustomerDto) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: {
        tenantId,
        email: dto.email.toLowerCase(),
        isActive: true,
      },
    });

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.prisma.storeCustomer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = this.generateToken(customer.id, tenantId, customer.tokenVersion ?? 0);

    return {
      customer: this.mapCustomerToResponse(customer),
      token,
    };
  }

  /**
   * Get current customer profile
   */
  async getProfile(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: {
        id: customerId,
        tenantId,
        isActive: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.mapCustomerToResponse(customer);
  }

  /**
   * Update customer profile
   */
  async updateProfile(tenantId: string, customerId: string, dto: UpdateProfileDto) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.acceptsMarketing !== undefined && { acceptsMarketing: dto.acceptsMarketing }),
      },
    });

    return this.mapCustomerToResponse(updated);
  }

  /**
   * Change password
   */
  async changePassword(tenantId: string, customerId: string, dto: ChangePasswordDto) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer || !customer.passwordHash) {
      throw new NotFoundException('Customer not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    // Increment tokenVersion to revoke existing tokens + invalidate pending reset tokens
    await this.prisma.$transaction([
      this.prisma.storeCustomer.update({
        where: { id: customerId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.passwordReset.updateMany({
        where: { customerId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Request password reset
   */
  async forgotPassword(tenantId: string, email: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: {
        tenantId,
        email: email.toLowerCase(),
        isActive: true,
      },
    });

    // Always return success to prevent email enumeration
    if (!customer) {
      return { success: true, message: 'If the email exists, a reset link will be sent' };
    }

    // Generate reset token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY);

    // Invalidate any existing unused reset tokens for this customer, then create new one
    await this.prisma.$transaction([
      this.prisma.passwordReset.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordReset.create({
        data: {
          tenantId,
          customerId: customer.id,
          token,
          expiresAt,
        },
      }),
    ]);

    // Send password reset email
    this.sendPasswordResetEmail(customer.id, tenantId, token);

    return { success: true, message: 'If the email exists, a reset link will be sent' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(tenantId: string, token: string, newPassword: string) {
    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        token,
        tenantId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and mark token as used
    // Increment tokenVersion to revoke existing tokens + invalidate ALL pending reset tokens
    await this.prisma.$transaction([
      this.prisma.storeCustomer.update({
        where: { id: resetRecord.customerId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.passwordReset.updateMany({
        where: { customerId: resetRecord.customerId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true, message: 'Password reset successfully' };
  }

  /**
   * Send verification email to customer
   */
  async sendVerificationEmail(customerId: string, tenantId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if already verified
    if (customer.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate verification token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

    // Delete any existing verification tokens for this customer
    await this.prisma.emailVerificationToken.deleteMany({
      where: { customerId, tenantId },
    });

    // Create new verification token
    await this.prisma.emailVerificationToken.create({
      data: {
        tenantId,
        customerId,
        token,
        expiresAt,
      },
    });

    // Send verification email
    this.sendEmailVerificationEmail(customerId, tenantId, token);

    return { success: true, message: 'Verification email sent' };
  }

  /**
   * Verify customer email with token
   */
  async verifyEmail(tenantId: string, token: string) {
    const verificationRecord = await this.prisma.emailVerificationToken.findFirst({
      where: {
        token,
        tenantId,
        expiresAt: { gt: new Date() },
      },
      include: {
        customer: true,
      },
    });

    if (!verificationRecord) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if already verified
    if (verificationRecord.customer.emailVerified) {
      return { success: true, message: 'Email already verified' };
    }

    // Update customer as verified and delete the token
    await this.prisma.$transaction([
      this.prisma.storeCustomer.update({
        where: { id: verificationRecord.customerId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.delete({
        where: { id: verificationRecord.id },
      }),
    ]);

    this.logger.log(`Email verified for customer: ${verificationRecord.customer.email}`);

    return { success: true, message: 'Email verified successfully' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(tenantId: string, customerId: string) {
    const customer = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, tenantId, isActive: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Check for recent verification emails (rate limiting - 1 per 5 minutes)
    const recentToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        customerId,
        tenantId,
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes ago
      },
    });

    if (recentToken) {
      throw new BadRequestException('Please wait 5 minutes before requesting another verification email');
    }

    return this.sendVerificationEmail(customerId, tenantId);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET, {
        issuer: 'storefront',
        audience: 'storefront',
        algorithms: ['HS256'],
      }) as {
        customerId: string;
        tenantId: string;
        tokenVersion?: number;
      };

      // Verify token version hasn't been revoked (AUTH-9)
      // Always check - tokens without version are from before versioning and should be revoked
      const customer = await this.prisma.storeCustomer.findUnique({
        where: { id: payload.customerId },
        select: { tokenVersion: true },
      });

      if (customer) {
        const tokenVer = payload.tokenVersion ?? 0;
        if (customer.tokenVersion !== null && customer.tokenVersion !== tokenVer) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  // ============ ADDRESS MANAGEMENT ============

  /**
   * Get customer addresses
   */
  async getAddresses(tenantId: string, customerId: string) {
    const addresses = await this.prisma.storeAddress.findMany({
      where: { tenantId, customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return addresses;
  }

  /**
   * Add address
   */
  async addAddress(tenantId: string, customerId: string, dto: AddAddressDto) {
    // If this is the first address or marked as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.storeAddress.updateMany({
        where: { tenantId, customerId },
        data: { isDefault: false },
      });
    }

    const addressCount = await this.prisma.storeAddress.count({
      where: { tenantId, customerId },
    });

    const address = await this.prisma.storeAddress.create({
      data: {
        tenantId,
        customerId,
        label: dto.label || 'Home',
        firstName: dto.firstName,
        lastName: dto.lastName,
        company: dto.company,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        phone: dto.phone,
        isDefault: dto.isDefault || addressCount === 0, // First address is always default
      },
    });

    return address;
  }

  /**
   * Update address
   */
  async updateAddress(
    tenantId: string,
    customerId: string,
    addressId: string,
    dto: Partial<AddAddressDto>
  ) {
    const existing = await this.prisma.storeAddress.findFirst({
      where: { id: addressId, tenantId, customerId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.storeAddress.updateMany({
        where: { tenantId, customerId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.storeAddress.update({
      where: { id: addressId },
      data: {
        ...(dto.label && { label: dto.label }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.addressLine1 && { addressLine1: dto.addressLine1 }),
        ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 }),
        ...(dto.city && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode && { postalCode: dto.postalCode }),
        ...(dto.country && { country: dto.country }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });

    return address;
  }

  /**
   * Delete address
   */
  async deleteAddress(tenantId: string, customerId: string, addressId: string) {
    const existing = await this.prisma.storeAddress.findFirst({
      where: { id: addressId, tenantId, customerId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.storeAddress.delete({
      where: { id: addressId },
    });

    // If deleted address was default, make the first remaining address default
    if (existing.isDefault) {
      const firstAddress = await this.prisma.storeAddress.findFirst({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'asc' },
      });

      if (firstAddress) {
        await this.prisma.storeAddress.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true };
  }

  // ============ HELPERS ============

  private generateToken(customerId: string, tenantId: string, tokenVersion = 0): string {
    return jwt.sign(
      { customerId, tenantId, tokenVersion },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, issuer: 'storefront', audience: 'storefront' }
    );
  }

  private mapCustomerToResponse(customer: any) {
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      emailVerified: customer.emailVerified,
      acceptsMarketing: customer.acceptsMarketing,
      createdAt: customer.createdAt,
    };
  }

  /**
   * Send welcome email to new customer asynchronously (non-critical)
   */
  private async sendWelcomeEmailAsync(customerId: string, tenantId: string) {
    if (!this.emailService) {
      this.logger.warn('Email service not available, skipping welcome email');
      return;
    }

    try {
      const customer = await this.prisma.storeCustomer.findUnique({
        where: { id: customerId },
        include: { tenant: true },
      });

      if (!customer) {
        return;
      }

      await this.emailService.sendAsync({
        to: customer.email,
        template: 'store-account-welcome',
        subject: '', // Will be set by template
        context: {
          type: 'store-account-welcome',
          tenantId,
          recipientName: `${customer.firstName} ${customer.lastName}`,
          recipientEmail: customer.email,
          actionUrl: `${process.env['STORE_URL'] || process.env['FRONTEND_URL']}/storefront/products`,
          company: {
            name: customer.tenant.businessName || customer.tenant.name,
            supportEmail: customer.tenant.email || 'support@example.com',
          },
        },
      });

      this.logger.log(`Welcome email queued for: ${customer.email}`);
    } catch (error) {
      this.logger.error(`Failed to queue welcome email for customer ${customerId}:`, error);
    }
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(customerId: string, tenantId: string, resetToken: string) {
    if (!this.emailService) {
      this.logger.warn('Email service not available, skipping password reset email');
      return;
    }

    try {
      const customer = await this.prisma.storeCustomer.findUnique({
        where: { id: customerId },
        include: { tenant: true },
      });

      if (!customer) {
        return;
      }

      const resetUrl = `${process.env['STORE_URL'] || process.env['FRONTEND_URL']}/storefront/account/reset-password?token=${resetToken}`;

      await this.emailService.sendStorePasswordReset({
        type: 'store-password-reset',
        tenantId,
        recipientName: `${customer.firstName} ${customer.lastName}`,
        recipientEmail: customer.email,
        actionUrl: resetUrl,
        company: {
          name: customer.tenant.businessName || customer.tenant.name,
          supportEmail: customer.tenant.email || 'support@example.com',
        },
      });

      this.logger.log(`Password reset email sent to: ${customer.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to customer ${customerId}:`, error);
    }
  }

  /**
   * Send email verification email
   */
  private async sendEmailVerificationEmail(customerId: string, tenantId: string, verificationToken: string) {
    if (!this.emailService) {
      this.logger.warn('Email service not available, skipping verification email');
      return;
    }

    try {
      const customer = await this.prisma.storeCustomer.findUnique({
        where: { id: customerId },
        include: { tenant: true },
      });

      if (!customer) {
        return;
      }

      const verificationUrl = `${process.env['STORE_URL'] || process.env['FRONTEND_URL']}/storefront/account/verify-email?token=${verificationToken}`;

      await this.emailService.sendStoreEmailVerification({
        type: 'store-email-verification',
        tenantId,
        recipientName: `${customer.firstName} ${customer.lastName}`,
        recipientEmail: customer.email,
        actionUrl: verificationUrl,
        company: {
          name: customer.tenant.businessName || customer.tenant.name,
          supportEmail: customer.tenant.email || 'support@example.com',
        },
      });

      this.logger.log(`Verification email sent to: ${customer.email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to customer ${customerId}:`, error);
    }
  }
}
