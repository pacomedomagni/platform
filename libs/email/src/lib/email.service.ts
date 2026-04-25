import { Injectable, Inject, OnModuleInit, Logger, Optional, BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { Transporter } from 'nodemailer';
import {
  EmailModuleOptions,
  EMAIL_MODULE_OPTIONS,
  SendEmailOptions,
  SendEmailResult,
  NotificationEmailContext,
  NotificationType,
} from './email.types';
import { EmailTemplateService } from './template.service';
import type { QueueService } from '@platform/queue';
import type { PrismaService } from '@platform/db';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(
    @Inject(EMAIL_MODULE_OPTIONS) private readonly options: EmailModuleOptions,
    private readonly templateService: EmailTemplateService,
    @Optional() @Inject('QueueService') private readonly queueService?: QueueService,
    @Optional() @Inject('PrismaService') private readonly prisma?: PrismaService,
  ) {
    this.transporter = nodemailer.createTransport(options.smtp);
  }

  async onModuleInit(): Promise<void> {
    // Load templates if path is provided
    if (this.options.templatesPath) {
      await this.templateService.loadTemplatesFromDirectory(this.options.templatesPath);
    }

    // Register default notification templates
    this.registerDefaultTemplates();

    // Verify connection
    if (!this.options.previewMode) {
      try {
        await this.transporter.verify();
        this.logger.log('Email service connected to SMTP server');
      } catch (error) {
        this.logger.warn(`Email service could not verify SMTP connection: ${error}`);
      }
    } else {
      this.logger.log('Email service running in preview mode');
    }
  }

  private registerDefaultTemplates(): void {
    // Document notification template
    this.templateService.compileTemplate({
      name: 'document-notification',
      subject: '{{doctype}} {{docname}} - {{action}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">{{action}}</h2>
        <p>Hi {{recipientName}},</p>
        <p>{{message}}</p>
        {{#if documentUrl}}
        <p style="margin: 30px 0;">
          <a href="{{documentUrl}}" class="btn">View {{doctype}}</a>
        </p>
        {{/if}}
        {{#if details}}
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #475569;">Details</h4>
          <table style="width: 100%;">
            {{#each details}}
            <tr>
              <td style="padding: 5px 0; color: #64748b;">{{@key}}:</td>
              <td style="padding: 5px 0; font-weight: 500;">{{this}}</td>
            </tr>
            {{/each}}
          </table>
        </div>
        {{/if}}
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          This is an automated notification from {{company.name}}.
        </p>
      `,
    });

    // Approval request template
    this.templateService.compileTemplate({
      name: 'approval-request',
      subject: 'Approval Required: {{doctype}} {{docname}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">Approval Required</h2>
        <p>Hi {{recipientName}},</p>
        <p>A {{doctype}} requires your approval.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: 500;">{{doctype}}: {{docname}}</p>
          {{#if message}}<p style="margin: 10px 0 0 0; color: #92400e;">{{message}}</p>{{/if}}
        </div>
        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">{{default actionText "Review & Approve"}}</a>
        </p>
        {{/if}}
      `,
    });

    // Payment notification template
    this.templateService.compileTemplate({
      name: 'payment-notification',
      subject: '{{#if (eq type "payment-received")}}Payment Received{{else}}Payment Due{{/if}}: {{details.invoiceNo}}',
      html: `
        {{#if (eq type "payment-received")}}
        <h2 style="margin: 0 0 20px 0; color: #059669;">Payment Received</h2>
        <p>Hi {{recipientName}},</p>
        <p>We have received your payment. Thank you!</p>
        {{else if (eq type "payment-overdue")}}
        <h2 style="margin: 0 0 20px 0; color: #dc2626;">Payment Overdue</h2>
        <p>Hi {{recipientName}},</p>
        <p>Your payment is overdue. Please settle the outstanding amount at your earliest convenience.</p>
        {{else}}
        <h2 style="margin: 0 0 20px 0; color: #d97706;">Payment Due</h2>
        <p>Hi {{recipientName}},</p>
        <p>This is a friendly reminder that your payment is due soon.</p>
        {{/if}}
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <table style="width: 100%;">
            {{#if details.invoiceNo}}<tr><td style="padding: 5px 0; color: #64748b;">Invoice:</td><td style="padding: 5px 0; font-weight: 500;">{{details.invoiceNo}}</td></tr>{{/if}}
            {{#if details.amount}}<tr><td style="padding: 5px 0; color: #64748b;">Amount:</td><td style="padding: 5px 0; font-weight: 500; font-size: 18px;">{{formatCurrency details.amount details.currency}}</td></tr>{{/if}}
            {{#if details.dueDate}}<tr><td style="padding: 5px 0; color: #64748b;">Due Date:</td><td style="padding: 5px 0; font-weight: 500;">{{formatDate details.dueDate 'long'}}</td></tr>{{/if}}
          </table>
        </div>
        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">{{default actionText "View Invoice"}}</a>
        </p>
        {{/if}}
      `,
    });

    // Welcome email template
    this.templateService.compileTemplate({
      name: 'welcome',
      subject: 'Welcome to {{company.name}}!',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">Welcome, {{recipientName}}!</h2>
        <p>Thank you for joining {{company.name}}. We're excited to have you on board.</p>
        {{#if message}}<p>{{message}}</p>{{/if}}
        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">{{default actionText "Get Started"}}</a>
        </p>
        {{/if}}
        <p style="margin-top: 30px;">If you have any questions, feel free to reach out to us.</p>
        <p>Best regards,<br>The {{company.name}} Team</p>
      `,
    });

    // Password reset template
    this.templateService.compileTemplate({
      name: 'password-reset',
      subject: 'Reset Your Password - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">Password Reset Request</h2>
        <p>Hi {{recipientName}},</p>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">Reset Password</a>
        </p>
        <p style="color: #64748b; font-size: 12px;">
          This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
        </p>
      `,
    });

    // Register storefront email templates
    this.registerStorefrontTemplates();
  }

  private registerStorefrontTemplates(): void {
    // Store Order Confirmation
    this.templateService.compileTemplate({
      name: 'store-order-confirmation',
      subject: 'Order Confirmed: #{{order.orderNumber}} - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #059669;">✓ Order Confirmed</h2>
        <p>Hi {{recipientName}},</p>
        <p>Thank you for your order! We've received your order and will begin processing it shortly.</p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-weight: 600; color: #166534;">Order #{{order.orderNumber}}</p>
          {{#if order.estimatedDelivery}}
          <p style="margin: 8px 0 0 0; color: #166534;">Estimated delivery: {{order.estimatedDelivery}}</p>
          {{/if}}
        </div>

        <h3 style="margin: 24px 0 16px 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          {{#each order.items}}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 0; vertical-align: top;">
              {{#if image}}
              <img src="{{image}}" alt="{{name}}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
              {{/if}}
            </td>
            <td style="padding: 12px 8px; vertical-align: top;">
              <p style="margin: 0; font-weight: 500;">{{name}}</p>
              {{#if variant}}<p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">{{variant}}</p>{{/if}}
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Qty: {{quantity}}</p>
            </td>
            <td style="padding: 12px 0; text-align: right; vertical-align: top;">
              <p style="margin: 0; font-weight: 500;">{{formatCurrency totalPrice ../order.currency}}</p>
            </td>
          </tr>
          {{/each}}
        </table>

        <table style="width: 100%; margin-top: 16px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Subtotal</td>
            <td style="padding: 4px 0; text-align: right;">{{formatCurrency order.subtotal order.currency}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Shipping</td>
            <td style="padding: 4px 0; text-align: right;">{{formatCurrency order.shipping order.currency}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Tax</td>
            <td style="padding: 4px 0; text-align: right;">{{formatCurrency order.tax order.currency}}</td>
          </tr>
          {{#if order.discount}}
          <tr>
            <td style="padding: 4px 0; color: #059669;">Discount</td>
            <td style="padding: 4px 0; text-align: right; color: #059669;">-{{formatCurrency order.discount order.currency}}</td>
          </tr>
          {{/if}}
          <tr style="border-top: 2px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 600; font-size: 18px;">Total</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 18px;">{{formatCurrency order.total order.currency}}</td>
          </tr>
        </table>

        <div style="display: flex; gap: 24px; margin-top: 24px;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Shipping Address</h4>
            <p style="margin: 0; line-height: 1.6;">
              {{order.shippingAddress.name}}<br>
              {{order.shippingAddress.line1}}<br>
              {{#if order.shippingAddress.line2}}{{order.shippingAddress.line2}}<br>{{/if}}
              {{order.shippingAddress.city}}, {{order.shippingAddress.state}} {{order.shippingAddress.postalCode}}<br>
              {{order.shippingAddress.country}}
            </p>
          </div>
          {{#if order.paymentMethod}}
          <div style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Payment Method</h4>
            <p style="margin: 0;">{{order.paymentMethod}}</p>
          </div>
          {{/if}}
        </div>

        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">View Order Details</a>
        </p>
        {{/if}}

        <p style="color: #64748b; margin-top: 24px;">
          If you have any questions about your order, please contact us at {{company.supportEmail}}.
        </p>
      `,
    });

    // Store Order Shipped
    this.templateService.compileTemplate({
      name: 'store-order-shipped',
      subject: 'Your Order Has Shipped! #{{order.orderNumber}} - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #2563eb;">📦 Your Order is On Its Way!</h2>
        <p>Hi {{recipientName}},</p>
        <p>Great news! Your order has been shipped and is on its way to you.</p>
        
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-weight: 600; color: #1e40af;">Order #{{order.orderNumber}}</p>
          {{#if order.trackingNumber}}
          <p style="margin: 8px 0 0 0; color: #1e40af;">Tracking: {{order.trackingNumber}}</p>
          {{/if}}
          {{#if order.estimatedDelivery}}
          <p style="margin: 8px 0 0 0; color: #1e40af;">Expected delivery: {{order.estimatedDelivery}}</p>
          {{/if}}
        </div>

        {{#if order.trackingUrl}}
        <p style="margin: 30px 0;">
          <a href="{{order.trackingUrl}}" class="btn">Track Your Package</a>
        </p>
        {{/if}}

        <h3 style="margin: 24px 0 16px 0; color: #1e293b;">Items in This Shipment</h3>
        <table style="width: 100%; border-collapse: collapse;">
          {{#each order.items}}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 0;">
              <p style="margin: 0; font-weight: 500;">{{name}} {{#if variant}}({{variant}}){{/if}}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Qty: {{quantity}}</p>
            </td>
          </tr>
          {{/each}}
        </table>

        <h4 style="margin: 24px 0 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Shipping To</h4>
        <p style="margin: 0; line-height: 1.6;">
          {{order.shippingAddress.name}}<br>
          {{order.shippingAddress.line1}}<br>
          {{#if order.shippingAddress.line2}}{{order.shippingAddress.line2}}<br>{{/if}}
          {{order.shippingAddress.city}}, {{order.shippingAddress.state}} {{order.shippingAddress.postalCode}}
        </p>

        <p style="color: #64748b; margin-top: 24px;">
          Questions? Contact us at {{company.supportEmail}}.
        </p>
      `,
    });

    // Store Order Delivered
    this.templateService.compileTemplate({
      name: 'store-order-delivered',
      subject: 'Your Order Has Been Delivered! #{{order.orderNumber}} - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #059669;">✓ Your Order Has Arrived!</h2>
        <p>Hi {{recipientName}},</p>
        <p>Your order #{{order.orderNumber}} has been delivered. We hope you love your purchase!</p>

        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">Leave a Review</a>
        </p>
        {{/if}}

        <p>Not happy with your order? We offer hassle-free returns within 30 days.</p>
        
        <p style="color: #64748b; margin-top: 24px;">
          Thank you for shopping with {{company.name}}!
        </p>
      `,
    });

    // Store Order Cancelled
    this.templateService.compileTemplate({
      name: 'store-order-cancelled',
      subject: 'Order Cancelled: #{{order.orderNumber}} - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #dc2626;">Order Cancelled</h2>
        <p>Hi {{recipientName}},</p>
        <p>Your order #{{order.orderNumber}} has been cancelled{{#if message}} - {{message}}{{/if}}.</p>
        
        {{#if order.total}}
        <p>If you were charged, a refund of <strong>{{formatCurrency order.total order.currency}}</strong> will be processed within 5-10 business days.</p>
        {{/if}}

        <p style="margin-top: 24px;">We're sorry to see you go. If you have any questions, please contact us at {{company.supportEmail}}.</p>
      `,
    });

    // Store Payment Confirmation
    this.templateService.compileTemplate({
      name: 'store-payment-confirmation',
      subject: 'Payment Confirmed for Order #{{order.orderNumber}} - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #059669;">✓ Payment Successful</h2>
        <p>Hi {{recipientName}},</p>
        <p>We've successfully processed your payment for order #{{order.orderNumber}}.</p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Order Number</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 500;">#{{order.orderNumber}}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Amount Paid</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 500;">{{formatCurrency order.total order.currency}}</td>
            </tr>
            {{#if order.paymentMethod}}
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Payment Method</td>
              <td style="padding: 4px 0; text-align: right;">{{order.paymentMethod}}</td>
            </tr>
            {{/if}}
          </table>
        </div>

        <p>A receipt has been sent to your email address.</p>
        
        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">View Order</a>
        </p>
        {{/if}}
      `,
    });

    // Store Account Welcome
    this.templateService.compileTemplate({
      name: 'store-account-welcome',
      subject: 'Welcome to {{company.name}}! 🎉',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">Welcome, {{recipientName}}!</h2>
        <p>Thanks for creating an account with {{company.name}}. We're thrilled to have you!</p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px 0; color: #1e293b;">What you can do with your account:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li style="margin-bottom: 8px;">Track your orders and view order history</li>
            <li style="margin-bottom: 8px;">Save multiple shipping addresses</li>
            <li style="margin-bottom: 8px;">Faster checkout with saved payment methods</li>
            <li style="margin-bottom: 8px;">Create wishlists and save favorites</li>
            <li>Get exclusive member-only offers</li>
          </ul>
        </div>

        {{#if actionUrl}}
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">Start Shopping</a>
        </p>
        {{/if}}

        <p style="color: #64748b; margin-top: 24px;">
          Happy shopping!<br>
          The {{company.name}} Team
        </p>
      `,
    });

    // Store Password Reset
    this.templateService.compileTemplate({
      name: 'store-password-reset',
      subject: 'Reset Your Password - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">Reset Your Password</h2>
        <p>Hi {{recipientName}},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">Reset Password</a>
        </p>

        <p style="color: #64748b; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 12px; margin-top: 24px;">
          <p style="margin: 0; color: #92400e; font-size: 13px;">
            ⚠️ If you didn't request this, someone may be trying to access your account. Consider changing your password.
          </p>
        </div>
      `,
    });

    // Store Email Verification
    this.templateService.compileTemplate({
      name: 'store-email-verification',
      subject: 'Verify Your Email Address - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">Verify Your Email Address</h2>
        <p>Hi {{recipientName}},</p>
        <p>Thank you for creating an account with {{company.name}}! Please verify your email address to activate your account and unlock all features.</p>

        <p style="margin: 30px 0;">
          <a href="{{actionUrl}}" class="btn">Verify Email Address</a>
        </p>

        <p style="color: #64748b; font-size: 14px;">
          This verification link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>

        <div style="background-color: #eff6ff; border-radius: 8px; padding: 12px; margin-top: 24px;">
          <p style="margin: 0; color: #1e40af; font-size: 13px;">
            ✓ Verifying your email ensures you can receive important order updates and notifications.
          </p>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="{{actionUrl}}" style="color: #2563eb; word-break: break-all;">{{actionUrl}}</a>
        </p>
      `,
    });

    // Abandoned Cart Recovery
    this.templateService.compileTemplate({
      name: 'store-abandoned-cart',
      subject: 'Did you forget something? 🛒 - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">You Left Something Behind!</h2>
        <p>Hi {{recipientName}},</p>
        <p>We noticed you left some items in your cart. They're waiting for you!</p>

        <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            {{#each cart.items}}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; width: 80px;">
                {{#if image}}
                <img src="{{image}}" alt="{{name}}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                {{/if}}
              </td>
              <td style="padding: 12px 8px;">
                <p style="margin: 0; font-weight: 500;">{{name}}</p>
                {{#if variant}}<p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">{{variant}}</p>{{/if}}
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Qty: {{quantity}}</p>
              </td>
              <td style="padding: 12px 0; text-align: right;">
                <p style="margin: 0; font-weight: 500;">{{formatCurrency totalPrice ../cart.currency}}</p>
              </td>
            </tr>
            {{/each}}
          </table>
          <div style="padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 8px;">
            <p style="margin: 0; text-align: right; font-weight: 600;">
              Cart Total: {{formatCurrency cart.subtotal cart.currency}}
            </p>
          </div>
        </div>

        <p style="margin: 30px 0;">
          <a href="{{recoveryUrl}}" class="btn">Complete Your Order</a>
        </p>

        <p style="color: #64748b; font-size: 14px;">
          Items in your cart may sell out. Don't miss out!
        </p>

        {{#if unsubscribeUrl}}
        <p style="color: #94a3b8; font-size: 11px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          You received this email because you have an active cart.
          <a href="{{unsubscribeUrl}}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> from marketing emails.
        </p>
        {{/if}}
      `,
    });

    // Back in Stock Notification
    this.templateService.compileTemplate({
      name: 'store-back-in-stock',
      subject: 'Good news! {{productName}} is back in stock - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #059669;">🎉 It's Back!</h2>
        <p>Hi {{recipientName}},</p>
        <p>Great news! The item you were waiting for is now back in stock:</p>

        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
          {{#if productImage}}
          <img src="{{productImage}}" alt="{{productName}}" style="max-width: 200px; border-radius: 8px; margin-bottom: 16px;">
          {{/if}}
          <h3 style="margin: 0 0 8px 0; color: #1e293b;">{{productName}}</h3>
          <p style="margin: 0; font-size: 20px; font-weight: 600; color: #059669;">{{formatCurrency productPrice productCurrency}}</p>
        </div>

        <p style="margin: 30px 0; text-align: center;">
          <a href="{{actionUrl}}" class="btn">Shop Now</a>
        </p>

        <p style="color: #64748b; text-align: center; font-size: 14px;">
          Hurry! Popular items sell fast.
        </p>

        {{#if unsubscribeUrl}}
        <p style="color: #94a3b8; font-size: 11px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
          <a href="{{unsubscribeUrl}}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> from marketing emails.
        </p>
        {{/if}}
      `,
    });

    // Review Request
    this.templateService.compileTemplate({
      name: 'store-review-request',
      subject: 'How was your purchase? - {{company.name}}',
      html: `
        <h2 style="margin: 0 0 20px 0; color: #1e293b;">How Did We Do?</h2>
        <p>Hi {{recipientName}},</p>
        <p>We hope you're enjoying your recent purchase! We'd love to hear your feedback.</p>

        <div style="text-align: center; margin: 30px 0;">
          <p style="margin-bottom: 16px; color: #64748b;">How would you rate your experience?</p>
          <p style="font-size: 32px; margin: 0;">⭐ ⭐ ⭐ ⭐ ⭐</p>
        </div>

        <p style="margin: 30px 0; text-align: center;">
          <a href="{{actionUrl}}" class="btn">Write a Review</a>
        </p>

        <p style="color: #64748b; text-align: center; font-size: 14px;">
          Your review helps other shoppers and helps us improve.
        </p>

        {{#if unsubscribeUrl}}
        <p style="color: #94a3b8; font-size: 11px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
          <a href="{{unsubscribeUrl}}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> from marketing emails.
        </p>
        {{/if}}
      `,
    });
  }

  /**
   * Send an email asynchronously via queue (for non-critical emails)
   */
  async sendAsync(emailOptions: SendEmailOptions): Promise<{ jobId: string }> {
    // Phase 3 W3.6: refuse to fall back to synchronous SMTP when the queue
    // is unavailable. The previous behaviour blocked the request thread on
    // SMTP I/O, which under a Redis outage caused cascading API request
    // timeouts. Better to return a clear 503 to the caller than to
    // mask the outage by silently degrading.
    if (!this.queueService) {
      this.logger.error(
        'sendAsync: queue service unavailable. Refusing synchronous SMTP fallback (W3.6).',
      );
      throw new Error('Email queue is unavailable');
    }

    // Phase 3 W3.3: tenantId is a required top-level field on the job
    // payload so workers can recover tenant context without reaching into
    // emailOptions.context (which is template data, not infra metadata).
    const tenantId = (emailOptions.context as { tenantId?: string } | undefined)?.tenantId;
    if (!tenantId) {
      this.logger.error(
        'sendAsync called without context.tenantId; refusing to enqueue an unscoped job',
      );
      throw new Error('Email send requires context.tenantId');
    }

    // Phase 3 W3.6: bounce suppression at enqueue time. The worker also
    // checks, but doing it here means we never burn a queue slot on a
    // mail we're going to drop anyway. If the bounce table has the
    // recipient, we log + audit and return without enqueuing.
    if (this.prisma) {
      const recipientEmail = this.firstRecipient(emailOptions.to);
      if (recipientEmail) {
        const suppressed = await this.prisma.emailBounce.findFirst({
          where: { tenantId, email: recipientEmail, suppressed: true },
          select: { id: true, type: true },
        });
        if (suppressed) {
          this.logger.warn(
            `sendAsync: dropping send to suppressed address ${recipientEmail} (bounce ${suppressed.type})`,
          );
          return { jobId: 'suppressed' };
        }
      }
    }

    try {
      const job = await this.queueService.sendEmail({ tenantId, emailOptions });
      this.logger.debug(`Email queued with job ID: ${job.id}`);
      return { jobId: job.id || 'unknown' };
    } catch (error) {
      this.logger.error('Failed to queue email', error);
      throw error;
    }
  }

  /** Phase 3 W3.6 helper. */
  private firstRecipient(
    to: SendEmailOptions['to'],
  ): string | undefined {
    const v = Array.isArray(to) ? to[0] : to;
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    return (v as { address?: string }).address;
  }

  /**
   * Send an email synchronously (for critical emails like password reset, email verification)
   */
  async send(emailOptions: SendEmailOptions): Promise<SendEmailResult> {
    let html = emailOptions.html;
    let text = emailOptions.text;
    let subject = emailOptions.subject;

    // If template is specified, render it
    if (emailOptions.template && emailOptions.context) {
      try {
        const rendered = this.templateService.render(emailOptions.template, emailOptions.context);
        subject = rendered.subject;
        html = this.templateService.wrapWithLayout(rendered.html, emailOptions.context);
        text = rendered.text;
      } catch (templateError) {
        this.logger.error(
          `Failed to render email template "${emailOptions.template}": ${templateError instanceof Error ? templateError.message : templateError}`
        );
        throw templateError;
      }
    } else if (html && emailOptions.context) {
      // Wrap plain HTML with layout
      html = this.templateService.wrapWithLayout(html, emailOptions.context);
    }

    // Validate attachment paths to prevent path traversal attacks
    if (emailOptions.attachments) {
      const SYSTEM_PATHS = ['/etc', '/proc', '/sys', '/dev', '/var', '/tmp', '/root', '/home'];
      for (const att of emailOptions.attachments) {
        if (att.path) {
          const normalizedPath = path.normalize(att.path);
          if (normalizedPath.includes('..')) {
            throw new BadRequestException(
              `Attachment path contains path traversal sequence: ${att.path}`,
            );
          }
          if (normalizedPath.startsWith('/')) {
            throw new BadRequestException(
              `Attachment path must not be an absolute path: ${att.path}`,
            );
          }
          const absoluteResolved = path.resolve(normalizedPath);
          if (SYSTEM_PATHS.some(sp => absoluteResolved.startsWith(sp))) {
            throw new BadRequestException(
              `Attachment path points to a restricted system directory: ${att.path}`,
            );
          }
        }
      }
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.convertAddress(emailOptions.from || this.options.defaults?.from),
      to: this.convertAddresses(emailOptions.to),
      cc: emailOptions.cc ? this.convertAddresses(emailOptions.cc) : undefined,
      bcc: emailOptions.bcc ? this.convertAddresses(emailOptions.bcc) : undefined,
      replyTo: this.convertAddress(emailOptions.replyTo || this.options.defaults?.replyTo),
      subject,
      html,
      text,
      attachments: emailOptions.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        path: att.path,
        contentType: att.contentType,
        encoding: att.encoding,
        cid: att.cid,
      })),
      headers: emailOptions.headers,
      priority: emailOptions.priority,
      messageId: emailOptions.messageId,
      references: emailOptions.references,
      inReplyTo: emailOptions.inReplyTo,
    };

    if (this.options.previewMode) {
      // Phase 3 W3.6: redact recipient + body in preview-mode logs. The
      // earlier shape logged the full address list and the first 200
      // chars of HTML to Pino, which then shipped to Loki — verification
      // codes, password-reset links, and customer email addresses leaked
      // into the centralised logging system.
      const previewId = `preview-${Date.now()}`;
      const accepted = Array.isArray(emailOptions.to)
        ? emailOptions.to.map((t) => (typeof t === 'string' ? t : t.address))
        : [typeof emailOptions.to === 'string' ? emailOptions.to : emailOptions.to.address];
      this.logger.log({
        previewId,
        recipientCount: accepted.length,
        recipientHash: accepted
          .map((a) => (a ? a.split('@')[1] || 'unknown' : 'unknown'))
          .join(','),
        subjectLength: subject.length,
        htmlLength: html?.length ?? 0,
      }, 'Email preview (redacted) — not sent');
      return {
        messageId: previewId,
        accepted,
        rejected: [],
        response: 'Preview mode - email not sent',
      };
    }

    const result = await this.transporter.sendMail(mailOptions);

    // Production log: messageId only. Recipient stays out of the centralised
    // log stream (W3.6).
    this.logger.log(`Email sent: ${result.messageId}`);

    return {
      messageId: result.messageId,
      accepted: result.accepted as string[],
      rejected: result.rejected as string[],
      response: result.response,
    };
  }

  /**
   * Send a notification email
   */
  async sendNotification(context: NotificationEmailContext): Promise<SendEmailResult> {
    const templateName = this.getTemplateForNotificationType(context.type);

    return this.send({
      to: {
        name: context.recipientName,
        address: context.recipientEmail,
      },
      template: templateName,
      subject: '', // Will be overridden by template
      context: {
        ...context,
        action: this.getActionText(context.type),
      },
    });
  }

  private getTemplateForNotificationType(type: NotificationType): string {
    switch (type) {
      case 'approval-required':
      case 'approval-granted':
      case 'approval-rejected':
        return 'approval-request';
      case 'payment-received':
      case 'payment-due':
      case 'payment-overdue':
        return 'payment-notification';
      case 'welcome':
        return 'welcome';
      case 'password-reset':
        return 'password-reset';
      case 'account-verification':
        return 'welcome';
      // Storefront templates
      case 'store-order-confirmation':
        return 'store-order-confirmation';
      case 'store-order-shipped':
        return 'store-order-shipped';
      case 'store-order-delivered':
        return 'store-order-delivered';
      case 'store-order-cancelled':
        return 'store-order-cancelled';
      case 'store-payment-confirmation':
        return 'store-payment-confirmation';
      case 'store-account-welcome':
        return 'store-account-welcome';
      case 'store-password-reset':
        return 'store-password-reset';
      case 'store-email-verification':
        return 'store-email-verification';
      case 'store-abandoned-cart':
        return 'store-abandoned-cart';
      case 'store-back-in-stock':
        return 'store-back-in-stock';
      case 'store-review-request':
        return 'store-review-request';
      default:
        return 'document-notification';
    }
  }

  private getActionText(type: NotificationType): string {
    const actionTexts: Record<NotificationType, string> = {
      'document-created': 'New Document Created',
      'document-submitted': 'Document Submitted',
      'document-cancelled': 'Document Cancelled',
      'document-amended': 'Document Amended',
      'approval-required': 'Approval Required',
      'approval-granted': 'Approval Granted',
      'approval-rejected': 'Approval Rejected',
      'payment-received': 'Payment Received',
      'payment-due': 'Payment Due',
      'payment-overdue': 'Payment Overdue',
      'stock-low': 'Low Stock Alert',
      'order-confirmed': 'Order Confirmed',
      'delivery-scheduled': 'Delivery Scheduled',
      'invoice-generated': 'Invoice Generated',
      'welcome': 'Welcome',
      'password-reset': 'Password Reset',
      'account-verification': 'Verify Account',
      // Storefront action texts
      'store-order-confirmation': 'Order Confirmed',
      'store-order-shipped': 'Order Shipped',
      'store-order-delivered': 'Order Delivered',
      'store-order-cancelled': 'Order Cancelled',
      'store-payment-confirmation': 'Payment Confirmed',
      'store-account-welcome': 'Welcome',
      'store-password-reset': 'Reset Password',
      'store-email-verification': 'Verify Email',
      'store-abandoned-cart': 'Complete Your Order',
      'store-back-in-stock': 'Back in Stock',
      'store-review-request': 'Leave a Review',
    };
    return actionTexts[type] || 'Notification';
  }

  /**
   * Send a simple text email
   */
  async sendText(
    to: string | string[],
    subject: string,
    text: string,
  ): Promise<SendEmailResult> {
    return this.send({ to, subject, text });
  }

  /**
   * Send a simple HTML email
   */
  async sendHtml(
    to: string | string[],
    subject: string,
    html: string,
    context?: Record<string, unknown>,
  ): Promise<SendEmailResult> {
    return this.send({ to, subject, html, context });
  }

  /**
   * Test the SMTP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // STOREFRONT EMAIL CONVENIENCE METHODS
  // ============================================================

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    context: import('./email.types').StoreOrderEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-order-confirmation',
    });
  }

  /**
   * Send order shipped email
   */
  async sendOrderShipped(
    context: import('./email.types').StoreOrderEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-order-shipped',
    });
  }

  /**
   * Send order delivered email
   */
  async sendOrderDelivered(
    context: import('./email.types').StoreOrderEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-order-delivered',
    });
  }

  /**
   * Send order cancelled email
   */
  async sendOrderCancelled(
    context: import('./email.types').StoreOrderEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-order-cancelled',
    });
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(
    context: import('./email.types').StoreOrderEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-payment-confirmation',
    });
  }

  /**
   * Send storefront account welcome email
   */
  async sendStoreWelcome(
    context: import('./email.types').NotificationEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-account-welcome',
    });
  }

  /**
   * Send storefront password reset email
   */
  async sendStorePasswordReset(
    context: import('./email.types').NotificationEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-password-reset',
    });
  }

  /**
   * Send storefront email verification email
   */
  async sendStoreEmailVerification(
    context: import('./email.types').NotificationEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-email-verification',
    });
  }

  /**
   * Send abandoned cart email
   */
  async sendAbandonedCart(
    context: import('./email.types').AbandonedCartEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-abandoned-cart',
    });
  }

  /**
   * Send back in stock notification
   */
  async sendBackInStock(
    context: import('./email.types').NotificationEmailContext & {
      productName: string;
      productImage?: string;
      productPrice: number;
      productCurrency: string;
    },
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-back-in-stock',
    });
  }

  /**
   * Send review request email
   */
  async sendReviewRequest(
    context: import('./email.types').NotificationEmailContext,
  ): Promise<SendEmailResult> {
    return this.sendNotification({
      ...context,
      type: 'store-review-request',
    });
  }

  /**
   * Convert EmailAddress to nodemailer Address format
   */
  private convertAddress(addr: string | import('./email.types').EmailAddress | undefined): string | { name: string; address: string } | undefined {
    if (!addr) return undefined;
    if (typeof addr === 'string') return addr;
    return { name: addr.name || '', address: addr.address };
  }

  /**
   * Convert array of EmailAddress to nodemailer format
   */
  private convertAddresses(
    addrs: string | string[] | import('./email.types').EmailAddress | import('./email.types').EmailAddress[]
  ): string | { name: string; address: string } | (string | { name: string; address: string })[] {
    if (typeof addrs === 'string') return addrs;
    if (Array.isArray(addrs)) {
      return addrs.map(a => {
        if (typeof a === 'string') return a;
        return { name: a.name || '', address: a.address };
      });
    }
    return { name: addrs.name || '', address: addrs.address };
  }
}
