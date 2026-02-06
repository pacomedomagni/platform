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
  | 'account-verification'
  // Storefront notification types
  | 'store-order-confirmation'
  | 'store-order-shipped'
  | 'store-order-delivered'
  | 'store-order-cancelled'
  | 'store-payment-confirmation'
  | 'store-account-welcome'
  | 'store-password-reset'
  | 'store-email-verification'
  | 'store-abandoned-cart'
  | 'store-back-in-stock'
  | 'store-review-request';

// Storefront order item for emails
export interface StoreOrderItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image?: string;
  variant?: string;
}

// Storefront order context for emails
export interface StoreOrderEmailContext extends NotificationEmailContext {
  order: {
    orderNumber: string;
    status: string;
    items: StoreOrderItem[];
    subtotal: number;
    shipping: number;
    tax: number;
    discount?: number;
    total: number;
    currency: string;
    shippingAddress: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    billingAddress?: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
    paymentMethod?: string;
  };
}

// Abandoned cart email context
export interface AbandonedCartEmailContext extends NotificationEmailContext {
  cart: {
    items: StoreOrderItem[];
    subtotal: number;
    currency: string;
  };
  recoveryUrl: string;
  expiresAt?: string;
}

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
