import { IsString, IsOptional, IsDateString, IsEnum, IsInt, Min, IsArray, IsObject } from 'class-validator';

// ==========================================
// Audit Log DTOs
// ==========================================

export class AuditLogQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsEnum(['create', 'update', 'delete', 'login', 'logout', 'export', 'import', 'other'])
  @IsOptional()
  action?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}

export class CreateAuditLogDto {
  @IsString()
  action!: string;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsObject()
  @IsOptional()
  oldValues?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  newValues?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ==========================================
// Webhook DTOs
// ==========================================

export class CreateWebhookDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsString()
  @IsOptional()
  secret?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}

export class UpdateWebhookDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @IsString()
  @IsOptional()
  secret?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsEnum(['active', 'paused', 'disabled'])
  @IsOptional()
  status?: 'active' | 'paused' | 'disabled';
}

// ==========================================
// Background Job DTOs
// ==========================================

export class CreateJobDto {
  @IsString()
  type!: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  priority?: number;
}

export class JobQueryDto {
  @IsEnum(['pending', 'running', 'completed', 'failed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}

// ==========================================
// Import/Export DTOs
// ==========================================

export class ImportDto {
  @IsEnum(['products', 'customers', 'inventory', 'orders'])
  entityType!: 'products' | 'customers' | 'inventory' | 'orders';

  @IsEnum(['csv', 'json'])
  format!: 'csv' | 'json';

  @IsObject()
  @IsOptional()
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
    dryRun?: boolean;
  };
}

export class ExportDto {
  @IsEnum(['products', 'customers', 'inventory', 'orders', 'transactions'])
  entityType!: 'products' | 'customers' | 'inventory' | 'orders' | 'transactions';

  @IsEnum(['csv', 'json'])
  format!: 'csv' | 'json';

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;
}

// ==========================================
// Notification DTOs
// ==========================================

export class CreateNotificationDto {
  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsEnum(['info', 'success', 'warning', 'error'])
  @IsOptional()
  type?: 'info' | 'success' | 'warning' | 'error';

  @IsString()
  @IsOptional()
  link?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class NotificationQueryDto {
  @IsEnum(['unread', 'read', 'all'])
  @IsOptional()
  status?: 'unread' | 'read' | 'all';

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}
