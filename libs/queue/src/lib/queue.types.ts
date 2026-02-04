import { JobsOptions } from 'bullmq';

export interface QueueModuleOptions {
  connection: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: JobsOptions;
}

export interface JobDefinition {
  name: string;
  queueName: string;
  handler: (job: unknown) => Promise<unknown>;
}

export const QUEUE_MODULE_OPTIONS = 'QUEUE_MODULE_OPTIONS';
export const QUEUE_PROCESSOR_METADATA = 'QUEUE_PROCESSOR_METADATA';
export const QUEUE_JOB_METADATA = 'QUEUE_JOB_METADATA';

export enum QueueName {
  EMAIL = 'email',
  PDF = 'pdf',
  NOTIFICATIONS = 'notifications',
  STOCK = 'stock',
  ACCOUNTING = 'accounting',
  REPORTS = 'reports',
  WEBHOOKS = 'webhooks',
  SCHEDULED = 'scheduled',
}

export interface EmailJobData {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  template: string;
  context: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
  tenantId: string;
}

export interface PdfJobData {
  template: string;
  doctype: string;
  docname: string;
  context: Record<string, unknown>;
  tenantId: string;
  outputPath?: string;
}

export interface NotificationJobData {
  type: 'email' | 'sms' | 'push' | 'in-app';
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: string[];
}

export interface WebhookJobData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  tenantId: string;
  retryCount?: number;
}

export interface StockJobData {
  action: 'recalculate' | 'reorder-check' | 'valuation-update';
  itemCode?: string;
  warehouseCode?: string;
  tenantId: string;
}

export interface AccountingJobData {
  action: 'post-gl' | 'period-close' | 'reconciliation';
  doctype?: string;
  docname?: string;
  tenantId: string;
  data?: Record<string, unknown>;
}

export interface ScheduledJobData {
  taskType: string;
  tenantId?: string;
  params?: Record<string, unknown>;
}
