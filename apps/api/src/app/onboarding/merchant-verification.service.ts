import { Injectable, Logger, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { EmailService } from '@platform/email';
import * as crypto from 'crypto';

@Injectable()
export class MerchantVerificationService {
  private readonly logger = new Logger(MerchantVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(EmailService) private readonly emailService?: EmailService,
  ) {}

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found for verification email`);
      return;
    }

    if (user.emailVerified) {
      return;
    }

    // Delete existing tokens for this user
    await this.prisma.merchantEmailVerificationToken.deleteMany({
      where: { userId },
    });

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.merchantEmailVerificationToken.create({
      data: { userId, token, expiresAt },
    });

    if (!this.emailService) {
      this.logger.warn('Email service not available, skipping verification email');
      return;
    }

    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:4200';
    const verifyUrl = `${frontendUrl}/app/verify-email?token=${token}`;

    await this.emailService.sendAsync({
      to: user.email,
      template: 'store-email-verification',
      subject: '',
      context: {
        type: 'store-email-verification',
        tenantId: user.tenantId,
        recipientName: user.firstName || user.email,
        recipientEmail: user.email,
        actionUrl: verifyUrl,
        company: {
          name: user.tenant.businessName || user.tenant.name,
          supportEmail: user.tenant.email || 'support@noslag.com',
        },
      },
    });

    this.logger.log(`Verification email sent to ${user.email}`);
  }

  async verifyEmail(token: string): Promise<{ success: boolean; email: string }> {
    const record = await this.prisma.merchantEmailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.merchantEmailVerificationToken.delete({ where: { id: record.id } });
      throw new BadRequestException('Verification token has expired. Please request a new one.');
    }

    // Mark user as verified
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    // Clean up all tokens for this user
    await this.prisma.merchantEmailVerificationToken.deleteMany({
      where: { userId: record.userId },
    });

    this.logger.log(`Email verified for user ${record.user.email}`);

    return { success: true, email: record.user.email };
  }

  async resendVerificationEmail(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      return { sent: false };
    }

    // Rate limit: check if a token was created in the last 60 seconds
    const recentToken = await this.prisma.merchantEmailVerificationToken.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentToken) {
      throw new BadRequestException('Please wait 60 seconds before requesting another verification email');
    }

    await this.sendVerificationEmail(userId);
    return { sent: true };
  }

  async getEmailStatus(userId: string): Promise<{ verified: boolean; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return { verified: user.emailVerified, email: user.email };
  }
}
