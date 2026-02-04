import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
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

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(
    @Inject(EMAIL_MODULE_OPTIONS) private readonly options: EmailModuleOptions,
    private readonly templateService: EmailTemplateService,
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
  }

  /**
   * Send an email
   */
  async send(emailOptions: SendEmailOptions): Promise<SendEmailResult> {
    let html = emailOptions.html;
    let text = emailOptions.text;
    let subject = emailOptions.subject;

    // If template is specified, render it
    if (emailOptions.template && emailOptions.context) {
      const rendered = this.templateService.render(emailOptions.template, emailOptions.context);
      subject = rendered.subject;
      html = this.templateService.wrapWithLayout(rendered.html, emailOptions.context);
      text = rendered.text;
    } else if (html && emailOptions.context) {
      // Wrap plain HTML with layout
      html = this.templateService.wrapWithLayout(html, emailOptions.context);
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: emailOptions.from || this.options.defaults?.from,
      to: emailOptions.to,
      cc: emailOptions.cc,
      bcc: emailOptions.bcc,
      replyTo: emailOptions.replyTo || this.options.defaults?.replyTo,
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
      this.logger.log('Email preview mode - would send:');
      this.logger.log(`  To: ${JSON.stringify(emailOptions.to)}`);
      this.logger.log(`  Subject: ${subject}`);
      this.logger.debug(`  HTML: ${html?.substring(0, 200)}...`);
      return {
        messageId: `preview-${Date.now()}`,
        accepted: Array.isArray(emailOptions.to) ? emailOptions.to.map(t => typeof t === 'string' ? t : t.address) : [typeof emailOptions.to === 'string' ? emailOptions.to : emailOptions.to.address],
        rejected: [],
        response: 'Preview mode - email not sent',
      };
    }

    const result = await this.transporter.sendMail(mailOptions);

    this.logger.log(`Email sent: ${result.messageId} to ${JSON.stringify(emailOptions.to)}`);

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
}
