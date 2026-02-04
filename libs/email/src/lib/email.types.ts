export const EMAIL_MODULE_OPTIONS = 'EMAIL_MODULE_OPTIONS';

export interface SmtpOptions {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
  };
}

export interface EmailModuleOptions {
  smtp: SmtpOptions;
  defaults?: {
    from?: string;
    replyTo?: string;
  };
  templatesPath?: string;
  previewMode?: boolean; // For development - logs email instead of sending
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  encoding?: string;
  cid?: string; // For inline images
}

export interface SendEmailOptions {
  to: string | string[] | EmailAddress | EmailAddress[];
  cc?: string | string[] | EmailAddress | EmailAddress[];
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  from?: string | EmailAddress;
  replyTo?: string | EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  context?: Record<string, unknown>;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  messageId?: string;
  references?: string[];
  inReplyTo?: string;
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

// Standard notification types
export type NotificationType =
  | 'document-created'
  | 'document-submitted'
  | 'document-cancelled'
  | 'document-amended'
  | 'approval-required'
  | 'approval-granted'
  | 'approval-rejected'
  | 'payment-received'
  | 'payment-due'
  | 'payment-overdue'
  | 'stock-low'
  | 'order-confirmed'
  | 'delivery-scheduled'
  | 'invoice-generated'
  | 'welcome'
  | 'password-reset'
  | 'account-verification';

export interface NotificationEmailContext {
  type: NotificationType;
  tenantId: string;
  recipientName: string;
  recipientEmail: string;
  doctype?: string;
  docname?: string;
  documentUrl?: string;
  actionUrl?: string;
  actionText?: string;
  message?: string;
  details?: Record<string, unknown>;
  company?: {
    name: string;
    logo?: string;
    website?: string;
    supportEmail?: string;
  };
}
